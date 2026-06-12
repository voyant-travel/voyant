// Reference HTTP server for executing `runtime: "node"` steps inside a
// Cloudflare Container.
//
// Two modes, selected at dispatch time:
//
//   1. **Baked-in bundle** — `WORKFLOW_BUNDLE` env var points at a
//      `container.mjs` imported at startup. Good for single-tenant
//      images and local tests.
//
//   2. **R2-loaded bundle** — each `POST /step` request carries a
//      `bundle: { url, hash }` pointing at an R2 signed URL. The
//      container fetches the body, verifies its SHA-256 matches the
//      hash, imports it once (cached by hash), and runs the step
//      against the loaded workflow registry. This is the multi-tenant
//      production path — one image serves every tenant's code.
//
// See `packages/workflows-orchestrator-cloudflare/src/cf-container-runner.ts`
// for the dispatching side.

import { createHash } from "node:crypto"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { __resetRegistry, getWorkflow } from "@voyantjs/workflows"
import {
  createBundleUrlPolicy,
  createHmacBodyVerifier,
  createHmacSigner,
  parseTokenList,
  STEP_AUTH_HEADER,
  STEP_RESPONSE_AUTH_HEADER,
} from "@voyantjs/workflows/auth"
import {
  type ExecuteWorkflowStepRequest,
  executeWorkflowStep,
  type StepJournalEntry,
  type StepRunner,
} from "@voyantjs/workflows/handler"

interface BundleLocation {
  url: string
  hash: string
}

type JournalSlice = ExecuteWorkflowStepRequest["journal"]

interface StepDispatchPayload {
  runId: string
  workflowId: string
  workflowVersion: string
  projectId?: string
  organizationId?: string
  stepId: string
  attempt: number
  input: unknown
  options?: { machine?: string; timeout?: string | number }
  bundle?: BundleLocation
  /** Journal at dispatch time — used to short-circuit body replay. */
  journal?: JournalSlice
}

/**
 * Sentinel thrown by the container's stepRunner after the target
 * step has executed. The executor treats it as a step failure; we
 * catch it post-hoc and surface the target step's journal entry
 * instead of the wrapped failure.
 */
const STOP_AFTER_TARGET = Symbol("STOP_AFTER_TARGET")

/**
 * Bundles loaded into this container process, keyed by their content
 * hash. Each entry is a promise that resolves once the bundle's
 * top-level `workflow()` calls have registered their definitions.
 *
 * Since `getWorkflow` reads from a single process-wide registry, we
 * call `__resetRegistry()` + re-import before handling a dispatch
 * whose bundle differs from the one currently loaded.
 */
const loadedBundles = new Map<string, Promise<void>>()
let activeBundleHash: string | undefined
const bundleUrlAllowed = createBundleUrlPolicy({
  allowedOrigins: parseTokenList(process.env.VOYANT_BUNDLE_ALLOWED_ORIGINS),
})

function normalizeHash(hash: string): string {
  return hash.replace(/^sha256:/i, "").toLowerCase()
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return createHash("sha256").update(bytes).digest("hex")
}

async function fetchBundle(bundle: BundleLocation): Promise<Uint8Array> {
  const decision = bundleUrlAllowed(bundle.url)
  if (!decision.ok) {
    throw new Error(decision.message)
  }
  const response = await fetch(bundle.url)
  if (!response.ok) {
    throw new Error(`bundle fetch returned HTTP ${response.status}`)
  }
  const buf = new Uint8Array(await response.arrayBuffer())
  const actual = await sha256Hex(buf)
  const expected = normalizeHash(bundle.hash)
  if (actual !== expected) {
    throw new Error(`bundle hash mismatch: expected ${expected}, got ${actual}`)
  }
  return buf
}

let bodyVerifierPromise:
  | Promise<(body: string, signature: string | null | undefined) => Promise<boolean>>
  | undefined
let responseSignerPromise: Promise<(body: string) => Promise<string>> | undefined

async function verifyStepRequest(req: IncomingMessage, rawBody: string): Promise<boolean> {
  const secret = process.env.VOYANT_WORKFLOW_STEP_AUTH_SECRET
  if (!secret) {
    if (process.env.VOYANT_WORKFLOW_STEP_ALLOW_UNAUTHENTICATED === "1") {
      console.warn(
        "[node-step-container] AUTH DISABLED: VOYANT_WORKFLOW_STEP_ALLOW_UNAUTHENTICATED=1",
      )
      return true
    }
    return false
  }
  bodyVerifierPromise ??= createHmacBodyVerifier(secret)
  const verifier = await bodyVerifierPromise
  const header = req.headers[STEP_AUTH_HEADER]
  const signature = Array.isArray(header) ? header[0] : header
  return verifier(rawBody, signature)
}

async function loadBundle(bundle: BundleLocation): Promise<void> {
  const key = normalizeHash(bundle.hash)
  const existing = loadedBundles.get(key)
  if (existing) {
    if (activeBundleHash !== key) {
      await existing
      activeBundleHash = key
    }
    return existing
  }
  const load = (async () => {
    const bytes = await fetchBundle(bundle)
    // Data URL import: Node can dynamic-import a data: URL and the
    // bundle's top-level `workflow()` calls populate the shared
    // registry. No filesystem write required.
    const dataUrl = `data:text/javascript;base64,${Buffer.from(bytes).toString("base64")}`
    __resetRegistry()
    await import(dataUrl)
    activeBundleHash = key
  })()
  loadedBundles.set(key, load)
  try {
    await load
  } catch (err) {
    // Don't cache failures — the next dispatch should try again.
    loadedBundles.delete(key)
    throw err
  }
}

async function ensureBundleLoaded(payload: StepDispatchPayload): Promise<void> {
  if (payload.bundle) {
    await loadBundle(payload.bundle)
    return
  }
  // No bundle in dispatch — fall back to the baked-in bundle if present.
  if (activeBundleHash === "baked-in") return
  if (process.env.WORKFLOW_BUNDLE) {
    await import(process.env.WORKFLOW_BUNDLE)
    activeBundleHash = "baked-in"
    return
  }
  throw new Error("no bundle available: dispatch carried no `bundle` and WORKFLOW_BUNDLE is unset")
}

async function handleStep(payload: StepDispatchPayload): Promise<StepJournalEntry> {
  try {
    await ensureBundleLoaded(payload)
  } catch (err) {
    return {
      attempt: payload.attempt,
      status: "err",
      startedAt: Date.now(),
      finishedAt: Date.now(),
      runtime: "node",
      error: {
        category: "RUNTIME_ERROR",
        code: "BUNDLE_LOAD_FAILED",
        message: err instanceof Error ? err.message : String(err),
      },
    }
  }

  const def = getWorkflow(payload.workflowId)
  if (!def) {
    return {
      attempt: payload.attempt,
      status: "err",
      startedAt: Date.now(),
      finishedAt: Date.now(),
      runtime: "node",
      error: {
        category: "USER_ERROR",
        code: "WORKFLOW_NOT_FOUND",
        message: `workflow "${payload.workflowId}" is not registered in the loaded bundle`,
      },
    }
  }

  // Run the step body in-process. The container exists for exactly
  // this — Node runtime + tenant bundle + one step to execute.
  //
  // Stop-after-target guard: after the target step runs, throw a
  // sentinel on any subsequent step dispatch so the executor stops
  // the body without running further steps. This prevents
  // over-execution when a workflow has multiple node steps.
  let targetDone = false
  const stepRunner: StepRunner = async ({ stepId, attempt, fn, stepCtx }) => {
    if (targetDone) {
      const e = new Error(`stop-after-target: refusing to run ${stepId}`)
      ;(e as Error & { sentinel?: symbol }).sentinel = STOP_AFTER_TARGET
      throw e
    }
    const startedAt = Date.now()
    try {
      const output = await fn(stepCtx)
      if (stepId === payload.stepId) targetDone = true
      return {
        attempt,
        status: "ok",
        output,
        startedAt,
        finishedAt: Date.now(),
        runtime: "node",
      }
    } catch (err) {
      const e = err as Error
      if (stepId === payload.stepId) targetDone = true
      return {
        attempt,
        status: "err",
        startedAt,
        finishedAt: Date.now(),
        runtime: "node",
        error: {
          category: "USER_ERROR",
          code:
            typeof (err as { code?: unknown }).code === "string"
              ? (err as { code: string }).code
              : "UNKNOWN",
          message: e?.message ?? String(err),
          name: e?.name,
          stack: e?.stack,
        },
      }
    }
  }

  // Journal pass-through: dispatched journal short-circuits body
  // replay on already-completed steps. Combined with the stop-after-
  // target guard above, this means the container executes the
  // target step body exactly once — no pre/post siblings re-run.
  const journalSlice = payload.journal ?? {
    stepResults: {},
    waitpointsResolved: {},
    compensationsRun: {},
    metadataState: {},
    streamsCompleted: {},
  }
  const req: ExecuteWorkflowStepRequest = {
    runId: payload.runId,
    workflowId: payload.workflowId,
    workflowVersion: payload.workflowVersion,
    input: payload.input,
    journal: journalSlice,
    invocationCount: 1,
    environment: {
      run: {
        id: payload.runId,
        number: 1,
        attempt: payload.attempt,
        triggeredBy: { kind: "api" },
        tags: [],
        startedAt: Date.now(),
      },
      workflow: { id: payload.workflowId, version: payload.workflowVersion },
      environment: {
        name: (process.env.VOYANT_ENV as "production" | "preview" | "development") ?? "production",
      },
      project: {
        id: payload.projectId ?? process.env.VOYANT_PROJECT_ID ?? "prj",
        slug: process.env.VOYANT_PROJECT_SLUG ?? "project",
      },
      organization: {
        id: payload.organizationId ?? process.env.VOYANT_ORG_ID ?? "org",
        slug: process.env.VOYANT_ORG_SLUG ?? "org",
      },
    },
    triggeredBy: { kind: "api" },
    runStartedAt: Date.now(),
    tags: [],
    stepRunner,
  }

  const response = await executeWorkflowStep(def, req)
  // The target step may have populated a journal entry even when the
  // overall response is `failed` — that's the expected outcome when
  // the stop-after-target sentinel fires on the next step. Prefer the
  // journal entry whenever it exists.
  const entry = response.journal.stepResults[payload.stepId]
  if (entry) return entry
  return {
    attempt: payload.attempt,
    status: "err",
    startedAt: Date.now(),
    finishedAt: Date.now(),
    runtime: "node",
    error: {
      category: "RUNTIME_ERROR",
      code: "STEP_NOT_EXECUTED",
      message: `step "${payload.stepId}" did not execute on the container — workflow ran to ${response.status} without reaching it`,
    },
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString("utf-8")
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const bytes = Buffer.from(JSON.stringify(body), "utf-8")
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(bytes.byteLength),
  })
  res.end(bytes)
}

async function signedStepJson(res: ServerResponse, status: number, body: unknown): Promise<void> {
  const text = JSON.stringify(body)
  const bytes = Buffer.from(text, "utf-8")
  const secret = process.env.VOYANT_WORKFLOW_STEP_AUTH_SECRET
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(bytes.byteLength),
  }
  if (secret) {
    responseSignerPromise ??= createHmacSigner(secret)
    headers[STEP_RESPONSE_AUTH_HEADER] = await (await responseSignerPromise)(text)
  }
  res.writeHead(status, headers)
  res.end(bytes)
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 8080)
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/step") {
      json(res, 404, { error: "not_found" })
      return
    }
    const rawBody = await readBody(req)
    if (!(await verifyStepRequest(req, rawBody))) {
      json(res, 401, { error: "unauthorized" })
      return
    }

    let payload: StepDispatchPayload
    try {
      payload = JSON.parse(rawBody) as StepDispatchPayload
    } catch (err) {
      json(res, 400, { error: "invalid_json", message: String(err) })
      return
    }
    try {
      const entry = await handleStep(payload)
      await signedStepJson(res, 200, entry)
    } catch (err) {
      json(res, 500, {
        error: "container_failure",
        message: err instanceof Error ? err.message : String(err),
      })
    }
  })

  server.listen(port, () => {
    const mode = process.env.WORKFLOW_BUNDLE ? "baked-in" : "r2-dynamic"
    console.log(`[node-step-container] listening on :${port} mode=${mode}`)
  })
}

main().catch((err) => {
  console.error("[node-step-container] fatal:", err)
  process.exit(1)
})

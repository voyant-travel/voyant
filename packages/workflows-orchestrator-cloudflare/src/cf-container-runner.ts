// Cloudflare Container-backed step runner for `runtime: "node"`.
//
// Given a Durable Object namespace that proxies a Cloudflare Container
// class (the `@cloudflare/containers` pattern), this factory returns a
// `StepRunner` the workflows handler can wire via its `nodeStepRunner`
// dep. The returned runner:
//
//   1. Serializes the step identity + input into a compact request.
//   2. Picks a container by deterministic id (`<runId>:<stepId>` so
//      parallel step invocations land on distinct instances).
//   3. POSTs the request to `/step` on that container via `fetch`
//      through the DO namespace binding.
//   4. Reads the container's response — which *is* a `StepJournalEntry`
//      (status, output/error, timestamps) — and returns it verbatim.
//
// The container side is expected to:
//   - import the tenant workflow bundle,
//   - expose `POST /step` that accepts `{ workflowId, workflowVersion,
//     stepId, attempt, input, envVars? }` and runs the step body,
//   - return a `StepJournalEntry` JSON.
//
// The container entry point is a short adapter around
// `@voyantjs/workflows/handler`'s `executeWorkflowStep` with the
// workflow registry already loaded. See
// `apps/workflows-node-step-container/` for the reference image.

import type { StepJournalEntry, StepRunner } from "@voyantjs/workflows/handler"

const STEP_RESPONSE_AUTH_HEADER = "x-voyant-step-response-auth"

/**
 * Minimal subset of `DurableObjectNamespace` that the runner actually
 * uses. Matches the shape exposed by `@cloudflare/containers`'
 * `getContainer(namespace, id).fetch()` pattern — we keep it local so
 * tests can pass a stub.
 */
export interface ContainerNamespaceLike {
  idFromName(name: string): { toString(): string }
  get(id: { toString(): string }): { fetch(request: Request): Promise<Response> }
}

export interface BundleLocation {
  /**
   * Short-lived signed URL the container uses to fetch the bundle
   * from R2. Expected TTL is minutes, not hours — scoped tightly to
   * the specific `<projectId>/<workflowVersion>/container.mjs` key.
   */
  url: string
  /**
   * SHA-256 hex of the bundle bytes, computed at deploy time and
   * stored alongside the bundle. The container verifies the
   * downloaded bytes match this hash before importing — both as an
   * integrity check and as a pin preventing stale-cache confusion.
   * Accepts both plain hex and `sha256:<hex>` formats.
   */
  hash: string
}

export interface CfContainerRunnerDeps {
  /**
   * DO namespace backing the Cloudflare Container class. Typically
   * `env.NODE_STEP_POOL` wired in wrangler.jsonc to a `Container`-
   * extending class (from `@cloudflare/containers`).
   */
  namespace: ContainerNamespaceLike
  /**
   * Resolve a signed R2 URL + manifest hash for the bundle the
   * container should import for this dispatch. Called on every
   * invocation (cache in the resolver if URL minting is expensive).
   *
   * If omitted, the dispatch payload has no `bundle` field and the
   * container must have its bundle baked into the image (via the
   * `WORKFLOW_BUNDLE` env var). Multi-tenant production uses the
   * resolver; single-tenant / dev images can skip it.
   */
  resolveBundle?: (args: {
    runId: string
    workflowId: string
    workflowVersion: string
    projectId: string
    organizationId: string
  }) => Promise<BundleLocation> | BundleLocation
  /**
   * Base URL presented to the container. The container's Worker
   * proxy only inspects the path, so this is cosmetic — defaults to
   * `https://node-step.voyant.internal`.
   */
  baseUrl?: string
  /**
   * Optional HMAC signer for the `X-Voyant-Step-Auth` header so the
   * container can verify the request came from a Voyant orchestrator.
   * Shape matches `createHmacSigner` from `@voyantjs/workflows/auth`.
   */
  sign?: (body: string) => Promise<string> | string
  /** Optional structured logger. */
  logger?: (level: "info" | "warn" | "error", msg: string, data?: object) => void
  /**
   * Build the container-addressing id for a given step invocation.
   * Default: `"<runId>:<attempt>:<stepId>"` — deterministic and
   * parallel-safe (distinct step invocations get distinct
   * containers, so the CF addressing model isolates them).
   */
  containerId?: (args: {
    runId: string
    workflowId: string
    workflowVersion: string
    stepId: string
    attempt: number
  }) => string
}

interface StepDispatchPayload {
  runId: string
  workflowId: string
  workflowVersion: string
  projectId: string
  organizationId: string
  stepId: string
  attempt: number
  input: unknown
  options: {
    machine?: string
    timeout?: string | number
  }
  /** Signed R2 URL + hash for the bundle to import. Absent when the
   *  container is single-tenant (bundle baked into the image). */
  bundle?: BundleLocation
  /**
   * Journal slice at dispatch time. The container uses it to
   * short-circuit already-completed steps on body replay and to stop
   * the drive cleanly after the target step. Passed as opaque JSON
   * here; the container knows how to consume it.
   */
  journal?: unknown
}

/**
 * Build a `StepRunner` that dispatches each step invocation to a
 * Cloudflare Container in the given namespace.
 *
 * Wire this into the orchestrator's step handler:
 *
 *   createStepHandler({
 *     nodeStepRunner: createCfContainerStepRunner({
 *       namespace: env.NODE_STEP_POOL,
 *     }),
 *   });
 *
 * Steps that declare `runtime: "node"` will route through here;
 * `runtime: "edge"` (or unset) continues to run inline.
 */
export function createCfContainerStepRunner(deps: CfContainerRunnerDeps): StepRunner {
  const baseUrl = deps.baseUrl ?? "https://node-step.voyant.internal"
  const idOf = deps.containerId ?? (({ runId, attempt, stepId }) => `${runId}:${attempt}:${stepId}`)

  return async ({
    stepId,
    attempt,
    input,
    stepCtx,
    runId,
    workflowId,
    workflowVersion,
    projectId,
    organizationId,
    options,
    journal,
  }): Promise<StepJournalEntry> => {
    const startedAt = Date.now()
    let bundle: BundleLocation | undefined
    if (deps.resolveBundle) {
      try {
        bundle = await deps.resolveBundle({
          runId,
          workflowId,
          workflowVersion,
          projectId,
          organizationId,
        })
      } catch (err) {
        deps.logger?.("error", "cf-container: resolveBundle threw", {
          runId,
          stepId,
          error: err instanceof Error ? err.message : String(err),
        })
        return failed(attempt, startedAt, "BUNDLE_RESOLVE_FAILED", err)
      }
    }
    const payload: StepDispatchPayload = {
      runId,
      workflowId,
      workflowVersion,
      projectId,
      organizationId,
      stepId,
      attempt,
      input,
      options: {
        machine: options.machine,
        timeout:
          typeof options.timeout === "string" || typeof options.timeout === "number"
            ? (options.timeout as string | number)
            : undefined,
      },
      bundle,
      journal,
    }
    const body = JSON.stringify(payload)
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
    }
    if (deps.sign) {
      headers["x-voyant-step-auth"] = await deps.sign(body)
    }

    const id = deps.namespace.idFromName(
      idOf({ runId, workflowId, workflowVersion, stepId, attempt }),
    )
    const stub = deps.namespace.get(id)
    const request = new Request(`${baseUrl}/step`, {
      method: "POST",
      headers,
      body,
      signal: stepCtx.signal,
    })

    deps.logger?.("info", "cf-container: dispatching step", {
      runId,
      workflowId,
      stepId,
      attempt,
    })

    let response: Response
    try {
      response = await stub.fetch(request)
    } catch (err) {
      deps.logger?.("error", "cf-container: fetch threw", {
        runId,
        stepId,
        error: err instanceof Error ? err.message : String(err),
      })
      return failed(attempt, startedAt, "CONTAINER_DISPATCH_FAILED", err)
    }

    const text = await response.text()
    if (response.status !== 200) {
      deps.logger?.("warn", "cf-container: non-200 response", {
        runId,
        stepId,
        status: response.status,
        body: text.slice(0, 500),
      })
      return failed(
        attempt,
        startedAt,
        "CONTAINER_HTTP_ERROR",
        new Error(`container returned HTTP ${response.status}: ${text}`),
      )
    }
    if (deps.sign) {
      const signature = response.headers.get(STEP_RESPONSE_AUTH_HEADER)
      const expected = await deps.sign(text)
      if (!signature || !constantTimeEquals(signature, expected)) {
        return failed(
          attempt,
          startedAt,
          "CONTAINER_RESPONSE_SIGNATURE_INVALID",
          new Error("container response signature is missing or invalid"),
        )
      }
    }
    try {
      const entry = JSON.parse(text) as StepJournalEntry
      // Trust the container's own timestamps; they reflect the actual
      // step body execution, not the dispatch round-trip.
      return entry
    } catch (err) {
      return failed(
        attempt,
        startedAt,
        "CONTAINER_INVALID_RESPONSE",
        new Error(`container returned non-JSON body: ${String(err)}`),
      )
    }
  }
}

function constantTimeEquals(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length, 1)
  let diff = a.length === b.length ? 0 : 1
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0)
  }
  return diff === 0
}

function failed(attempt: number, startedAt: number, code: string, err: unknown): StepJournalEntry {
  const e = err instanceof Error ? err : new Error(String(err))
  return {
    attempt,
    status: "err",
    startedAt,
    finishedAt: Date.now(),
    error: {
      category: "RUNTIME_ERROR",
      code,
      message: e.message,
      name: e.name,
      stack: e.stack,
    },
  }
}

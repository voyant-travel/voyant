// @voyant-travel/workflows/handler
//
// The tenant side of the runtime protocol (see docs/runtime-protocol.md §2).
// The orchestrator invokes `POST /__voyant/workflow-step`; the tenant
// Worker responds by running the workflow body once (one invocation of
// the executor) and returning the executor response as JSON.
//
//   export default { fetch: createStepHandler() }
//
// is enough to make a tenant Worker protocol-conformant. Auth is
// optional at the SDK level: in production, wire the HMAC verifier
// bundled by `voyant build`; for local dev, leave it unset.
//
// The executor's native response shape is returned verbatim — the wire
// document calls for compensated/compensation_failed to be folded into
// "failed" for the first draft, but since the draft is not yet locked
// and the executor-shape already round-trips losslessly, we keep the
// full discriminated union here. The orchestrator adapter can collapse.

import {
  type ExecuteWorkflowStepRequest,
  type ExecuteWorkflowStepResponse,
  executeWorkflowStep,
  type StepRunner,
} from "../runtime/executor.js"

export type { StepJournalEntry } from "../runtime/journal.js"
export type { ExecuteWorkflowStepRequest, ExecuteWorkflowStepResponse, StepRunner }
export { executeWorkflowStep }

import {
  PROTOCOL_VERSION,
  type ProtocolVersion,
  type WorkflowActivationMetadata,
} from "../protocol/index.js"
import type { RateLimiter } from "../rate-limit/index.js"
import type { RuntimeEnvironment } from "../runtime/ctx.js"
import type { JournalSlice, StepJournalEntry } from "../runtime/journal.js"
import type { RunTrigger } from "../types.js"
import { getWorkflow, type WorkflowDefinition } from "../workflow.js"

/** Resolves executable workflow definitions at the step execution boundary. */
export interface WorkflowResolver {
  resolve(workflowId: string): WorkflowDefinition | undefined
}

export interface StepHandlerDeps {
  /**
   * Explicit workflow lookup for this runtime. Runtime composition should
   * always provide this dependency so execution is isolated from the
   * process-global authoring registry.
   *
   * When omitted, the handler falls back to the legacy process-global
   * registry for backward compatibility with direct SDK callers.
   */
  workflowResolver?: WorkflowResolver
  /**
   * Optional. Called before parsing the body. Should throw / reject
   * if the request is not from a trusted orchestrator. In production
   * this verifies the `X-Voyant-Dispatch-Auth` HMAC against a public
   * key embedded by `voyant build`.
   */
  verifyRequest?: (req: Request) => void | Promise<void>
  /** Injectable clock. Defaults to Date.now. */
  now?: () => number
  /** Optional structured logger. */
  logger?: (level: "info" | "warn" | "error", msg: string, data?: object) => void
  /**
   * Rate limiter shared across step invocations. Required when any
   * registered workflow declares `options.rateLimit` on a step; see
   * `createInMemoryRateLimiter` in `@voyant-travel/workflows/rate-limit` for
   * the reference impl. One instance per Worker process is the
   * intended cardinality — state is kept in the limiter's closure.
   */
  rateLimiter?: RateLimiter
  /**
   * Read-only service resolver, surfaced to step bodies as `ctx.services`.
   * The framework's `createApp()` wires this from its `ModuleContainer`;
   * raw orchestrator harnesses (tests, ad-hoc scripts) typically leave
   * it unset, in which case `ctx.services.resolve(...)` throws with a
   * clear message. See architecture doc §11.
   */
  services?: import("../driver.js").ServiceResolver
}

/** The HTTP request body the orchestrator sends. */
export interface WorkflowStepRequest {
  protocolVersion: ProtocolVersion
  runId: string
  workflowId: string
  workflowVersion: string
  invocationCount: number
  input: unknown
  journal: JournalSlice
  environment: "production" | "preview" | "development"
  deadline: number
  tenantMeta: {
    tenantId: string
    projectId: string
    organizationId: string
    projectSlug?: string
    organizationSlug?: string
  }
  runMeta: {
    number: number
    attempt: number
    triggeredBy: RunTrigger
    tags: string[]
    startedAt: number
  }
  activation?: WorkflowActivationMetadata
}

/** The JSON response body the tenant returns. */
export type WorkflowStepResponse = ExecuteWorkflowStepResponse

/** Error-response envelope used for HTTP 4xx/5xx. */
export interface StepHandlerError {
  error: string
  message: string
  details?: unknown
}

export {
  type BuildResumeStepRequestInput,
  type BuildResumeStepRequestResult,
  buildResumeStepRequest,
} from "./resume.js"

/** Build an HTTP fetch-style handler. */
export function createStepHandler(deps: StepHandlerDeps = {}): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method !== "POST") {
      return jsonResponse(405, errorBody("method_not_allowed", "POST required"))
    }
    try {
      if (deps.verifyRequest) await deps.verifyRequest(req)
    } catch (err) {
      deps.logger?.("warn", "step handler: auth rejected", {
        error: err instanceof Error ? err.message : String(err),
      })
      return jsonResponse(401, errorBody("unauthorized", errMessage(err)))
    }
    let raw: unknown
    try {
      raw = await req.json()
    } catch (err) {
      return jsonResponse(400, errorBody("invalid_json", errMessage(err)))
    }
    // The incoming Request carries its own AbortSignal; threading it
    // through lets `ctx.signal` observe client-side aborts (orchestrator
    // cancellations, closed fetches, etc.) during step execution.
    const out = await runStepInner(raw, deps, { signal: req.signal })
    return jsonResponse(out.status, out.body)
  }
}

/** Per-invocation options available to callers of the transport-free entry point. */
export interface StepRequestOptions {
  /** AbortSignal forwarded to `ctx.signal` inside the step body. */
  signal?: AbortSignal
  /**
   * Fires synchronously from `ctx.stream.*` as each chunk is produced.
   * Used by orchestrators that want to broadcast chunks live
   * (dashboards, queues) before the invocation returns.
   */
  onStreamChunk?: (chunk: import("../runtime/executor.js").StreamChunk) => void
}

/**
 * Transport-free entry point. Callers that already parsed the body
 * (e.g. local orchestrator in-memory, tests) invoke this directly.
 * Returns either the step response or an error envelope with the HTTP
 * status the caller should use.
 */
export async function handleStepRequest(
  raw: unknown,
  deps: StepHandlerDeps = {},
  opts: StepRequestOptions = {},
): Promise<
  { status: number; body: WorkflowStepResponse } | { status: number; body: StepHandlerError }
> {
  return runStepInner(raw, deps, opts)
}

async function runStepInner(
  raw: unknown,
  deps: StepHandlerDeps,
  opts: StepRequestOptions = {},
): Promise<
  { status: number; body: WorkflowStepResponse } | { status: number; body: StepHandlerError }
> {
  const parsed = parseRequest(raw)
  if (!parsed.ok) return { status: 400, body: errorBody("invalid_request", parsed.message) }

  const reqBody = parsed.value
  if (reqBody.protocolVersion !== PROTOCOL_VERSION) {
    return {
      status: 426,
      body: errorBody(
        "protocol_version_mismatch",
        `tenant supports protocol ${PROTOCOL_VERSION}, got ${String(reqBody.protocolVersion)}`,
      ),
    }
  }

  const def = deps.workflowResolver
    ? deps.workflowResolver.resolve(reqBody.workflowId)
    : getWorkflow(reqBody.workflowId)
  if (!def) {
    return {
      status: 404,
      body: errorBody(
        "workflow_not_found",
        `workflow "${reqBody.workflowId}" is not registered in this bundle`,
      ),
    }
  }

  const now = deps.now ?? (() => Date.now())
  const stepRunner = createInProcessStepRunner(now)

  const runtimeEnv: RuntimeEnvironment = {
    run: {
      id: reqBody.runId,
      number: reqBody.runMeta.number,
      attempt: reqBody.runMeta.attempt,
      triggeredBy: reqBody.runMeta.triggeredBy,
      tags: reqBody.runMeta.tags,
      startedAt: reqBody.runMeta.startedAt,
    },
    workflow: { id: reqBody.workflowId, version: reqBody.workflowVersion },
    environment: { name: reqBody.environment },
    project: {
      id: reqBody.tenantMeta.projectId,
      slug: reqBody.tenantMeta.projectSlug ?? reqBody.tenantMeta.projectId,
    },
    organization: {
      id: reqBody.tenantMeta.organizationId,
      slug: reqBody.tenantMeta.organizationSlug ?? reqBody.tenantMeta.organizationId,
    },
  }

  try {
    const response = await executeWorkflowStep(def, {
      runId: reqBody.runId,
      workflowId: reqBody.workflowId,
      workflowVersion: reqBody.workflowVersion,
      input: reqBody.input,
      journal: reqBody.journal,
      invocationCount: reqBody.invocationCount,
      environment: runtimeEnv,
      triggeredBy: reqBody.runMeta.triggeredBy,
      runStartedAt: reqBody.runMeta.startedAt,
      tags: reqBody.runMeta.tags,
      stepRunner,
      rateLimiter: deps.rateLimiter,
      services: deps.services,
      now,
      abortSignal: opts.signal,
      onStreamChunk: opts.onStreamChunk,
    })
    return { status: 200, body: response }
  } catch (err) {
    deps.logger?.("error", "step handler: executor threw", {
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      status: 500,
      body: errorBody("executor_error", errMessage(err)),
    }
  }
}

/**
 * Build a step runner that executes the step body in the same
 * process. Hosted runtimes can replace this with a dispatching runner
 * that POSTs to a Node execution service.
 */
function createInProcessStepRunner(now: () => number): StepRunner {
  return async ({ stepId: _stepId, attempt, fn, stepCtx }): Promise<StepJournalEntry> => {
    const startedAt = now()
    try {
      const output = await fn(stepCtx)
      return {
        attempt,
        status: "ok",
        output,
        startedAt,
        finishedAt: now(),
      }
    } catch (err) {
      const e = err as Error
      const code =
        typeof (err as { code?: unknown }).code === "string"
          ? (err as { code: string }).code
          : "UNKNOWN"
      const retryAfter = (err as { retryAfter?: unknown }).retryAfter
      return {
        attempt,
        status: "err",
        error: {
          category: "USER_ERROR",
          code,
          message: e?.message ?? String(err),
          name: e?.name,
          stack: e?.stack,
          data: retryAfter !== undefined ? { retryAfter } : undefined,
        },
        startedAt,
        finishedAt: now(),
      }
    }
  }
}

// ---- Parsing ----

function parseRequest(
  raw: unknown,
): { ok: true; value: WorkflowStepRequest } | { ok: false; message: string } {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, message: "body must be a JSON object" }
  }
  const r = raw as Record<string, unknown>
  const required: (keyof WorkflowStepRequest)[] = [
    "protocolVersion",
    "runId",
    "workflowId",
    "workflowVersion",
    "invocationCount",
    "journal",
    "environment",
    "deadline",
    "tenantMeta",
    "runMeta",
  ]
  for (const k of required) {
    if (!(k in r)) return { ok: false, message: `missing required field "${k}"` }
  }
  if (typeof r.protocolVersion !== "number") {
    return { ok: false, message: "`protocolVersion` must be a number" }
  }
  if (typeof r.runId !== "string" || r.runId.length === 0) {
    return { ok: false, message: "`runId` must be a non-empty string" }
  }
  if (typeof r.workflowId !== "string" || r.workflowId.length === 0) {
    return { ok: false, message: "`workflowId` must be a non-empty string" }
  }
  if (typeof r.workflowVersion !== "string" || r.workflowVersion.length === 0) {
    return { ok: false, message: "`workflowVersion` must be a non-empty string" }
  }
  if (typeof r.invocationCount !== "number" || r.invocationCount < 1) {
    return { ok: false, message: "`invocationCount` must be >= 1" }
  }
  if (typeof r.deadline !== "number") {
    return { ok: false, message: "`deadline` must be a number" }
  }
  if (!r.journal || typeof r.journal !== "object") {
    return { ok: false, message: "`journal` must be an object" }
  }
  const env = r.environment
  if (env !== "production" && env !== "preview" && env !== "development") {
    return { ok: false, message: "`environment` must be production | preview | development" }
  }
  if (!r.tenantMeta || typeof r.tenantMeta !== "object") {
    return { ok: false, message: "`tenantMeta` must be an object" }
  }
  if (!r.runMeta || typeof r.runMeta !== "object") {
    return { ok: false, message: "`runMeta` must be an object" }
  }
  return {
    ok: true,
    value: {
      protocolVersion: r.protocolVersion as ProtocolVersion,
      runId: r.runId,
      workflowId: r.workflowId,
      workflowVersion: r.workflowVersion,
      invocationCount: r.invocationCount,
      input: r.input,
      journal: r.journal as JournalSlice,
      environment: env,
      deadline: r.deadline,
      tenantMeta: r.tenantMeta as WorkflowStepRequest["tenantMeta"],
      runMeta: r.runMeta as WorkflowStepRequest["runMeta"],
      activation: isObjectRecord(r.activation)
        ? (r.activation as WorkflowActivationMetadata)
        : undefined,
    },
  }
}

// ---- Helpers ----

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}

function errorBody(error: string, message: string, details?: unknown): StepHandlerError {
  const out: StepHandlerError = { error, message }
  if (details !== undefined) out.details = details
  return out
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// The workflow-step executor. Takes a registered workflow + journal and
// runs the body exactly once, yielding a response envelope.
//
// Corresponds to the tenant-side handler of POST /__voyant/workflow-step
// described in docs/runtime-protocol.md §2.1.

import type { SerializedError } from "../protocol/index.js"
import { durationToMs, type RateLimiter } from "../rate-limit/index.js"
import type { RunStatus, RunTrigger, WaitpointKind } from "../types.js"
import type { StepOptions, WorkflowDefinition } from "../workflow.js"
import { buildCtx, type RuntimeCallbacks, type RuntimeEnvironment } from "./ctx.js"
import { createClock, createRandom } from "./determinism.js"
import {
  isCompensateRequested,
  isRunCancelled,
  isWaitpointPending,
  RunCancelledSignal,
  WaitpointPendingSignal,
} from "./errors.js"
import type { JournalSlice, StepJournalEntry } from "./journal.js"

export type StepRunner = (
  /**
   * Executes a step body and returns the journal entry to record.
   *
   * In-process runners call `fn(stepCtx)` directly. Dispatching runners
   * ignore `fn` — they can't serialize a closure — and use the
   * run/workflow identity + step options to address a remote Node runner
   * and POST the required context.
   */
  args: {
    stepId: string
    attempt: number
    input: unknown
    fn: (stepCtx: import("../workflow.js").StepContext) => Promise<unknown>
    stepCtx: import("../workflow.js").StepContext
    /** Identity of the run — used by dispatching runners. */
    runId: string
    workflowId: string
    workflowVersion: string
    /** Project / organization id from the runtime environment — used by
     *  dispatching runners to resolve per-tenant bundle storage keys. */
    projectId: string
    organizationId: string
    /** Merged step options (machine, timeout, …). */
    options: import("../workflow.js").StepOptions<unknown>
    /**
     * Current journal slice at dispatch time — steps already completed,
     * waitpoints already resolved, etc. Dispatching runners pass this
     * to the remote executor so body replay there short-circuits on
     * cached steps, and the container can stop cleanly after the
     * target step runs.
     */
    journal: JournalSlice
  },
) => Promise<StepJournalEntry>

export interface WaitpointRegistration {
  clientWaitpointId: string
  kind: WaitpointKind
  meta: Record<string, unknown>
  timeoutMs?: number
}

export interface MetadataMutation {
  op: "set" | "increment" | "append" | "remove"
  key: string
  value?: unknown
  target?: "self" | "parent" | "root"
}

export interface CompensationReport {
  stepId: string
  status: "ok" | "err"
  error?: SerializedError
  durationMs: number
}

export interface StreamChunk {
  streamId: string
  seq: number
  encoding: "text" | "json" | "base64"
  chunk: unknown
  final: boolean
  at: number
}

export interface ExecuteWorkflowStepRequest {
  runId: string
  workflowId: string
  workflowVersion: string
  input: unknown
  journal: JournalSlice
  invocationCount: number
  environment: RuntimeEnvironment
  triggeredBy: RunTrigger
  runStartedAt: number
  tags: string[]
  abortSignal?: AbortSignal
  /**
   * Step executor. The default handler runs step bodies in-process on Node.
   * Hosted runtimes may replace it with a dispatching runner.
   */
  stepRunner: StepRunner
  /**
   * Optional rate limiter. When a step declares `options.rateLimit`,
   * the executor calls `rateLimiter.acquire(...)` before invoking the
   * step runner. Without a limiter, a step that declares `rateLimit`
   * fails with `RATE_LIMITER_MISSING` — declaring a limit and not
   * enforcing it would be silently dangerous.
   */
  rateLimiter?: RateLimiter
  /** `() => number` used for compensation durations. Defaults to Date.now. */
  now?: () => number
  /**
   * Optional per-chunk callback fired synchronously from
   * `ctx.stream.*` as each chunk is produced. Enables live streaming
   * (dashboards, queues) in-process before the invocation completes.
   * Chunks are still accumulated in the response's `streamChunks`
   * array so the at-end delivery keeps working.
   */
  onStreamChunk?: (chunk: StreamChunk) => void
  /**
   * Optional read-only service resolver, surfaced to the workflow body as
   * `ctx.services`. Wired by the framework through
   * `StepHandlerDeps.services` → here. When unset, `ctx.services.resolve(...)`
   * throws with a clear message — see `runtime/ctx.ts`.
   */
  services?: import("../driver.js").ServiceResolver
}

export type ExecuteWorkflowStepResponse =
  | {
      status: "completed"
      output: unknown
      metadataUpdates: MetadataMutation[]
      journal: JournalSlice
      streamChunks: StreamChunk[]
    }
  | {
      status: "failed"
      error: SerializedError
      metadataUpdates: MetadataMutation[]
      journal: JournalSlice
      streamChunks: StreamChunk[]
    }
  | {
      status: "cancelled"
      metadataUpdates: MetadataMutation[]
      journal: JournalSlice
      compensations: CompensationReport[]
      streamChunks: StreamChunk[]
    }
  | {
      status: "waiting"
      waitpoints: WaitpointRegistration[]
      metadataUpdates: MetadataMutation[]
      journal: JournalSlice
      streamChunks: StreamChunk[]
    }
  | {
      status: "compensated"
      /** Only set when compensation was triggered by an uncaught body error. */
      error?: SerializedError
      compensations: CompensationReport[]
      metadataUpdates: MetadataMutation[]
      journal: JournalSlice
      streamChunks: StreamChunk[]
    }
  | {
      status: "compensation_failed"
      error?: SerializedError
      compensations: CompensationReport[]
      metadataUpdates: MetadataMutation[]
      journal: JournalSlice
      streamChunks: StreamChunk[]
    }

interface Compensable {
  stepId: string
  output: unknown
  compensate: (output: unknown) => Promise<void>
}

export async function executeWorkflowStep(
  def: WorkflowDefinition,
  req: ExecuteWorkflowStepRequest,
): Promise<ExecuteWorkflowStepResponse> {
  const abortSignal = req.abortSignal ?? new AbortController().signal
  const now = req.now ?? (() => Date.now())
  const clock = createClock(req.runStartedAt)
  const random = createRandom(req.runId)
  const waitpoints: WaitpointRegistration[] = []
  const metadataUpdates: MetadataMutation[] = []
  const compensable: Compensable[] = []
  const streamChunks: StreamChunk[] = []
  const retryOverride: { current: import("../types.js").RetryPolicy | undefined } = {
    current: def.config.retry,
  }

  const callbacks: RuntimeCallbacks = {
    invocationCount: req.invocationCount,
    abortSignal,
    async runStep(args) {
      if (args.options.rateLimit) {
        await acquireRateLimit({
          spec: args.options.rateLimit,
          stepId: args.stepId,
          input: req.input,
          runId: req.runId,
          projectId: req.environment.project.id,
          limiter: req.rateLimiter,
          signal: abortSignal,
        })
      }
      const requestedRuntime = (args.options as { runtime?: unknown }).runtime
      if (requestedRuntime !== undefined && requestedRuntime !== "node") {
        const e = new Error(
          `step "${args.stepId}" declared runtime="${String(
            requestedRuntime,
          )}" but workflows are node-only; remove options.runtime or use runtime="node"`,
        )
        ;(e as Error & { code?: string }).code = "UNSUPPORTED_WORKFLOW_RUNTIME"
        throw e
      }
      const entry = await req.stepRunner({
        stepId: args.stepId,
        attempt: args.attempt,
        input: args.input,
        fn: args.fn,
        stepCtx: args.stepCtx,
        runId: req.runId,
        workflowId: req.workflowId,
        workflowVersion: req.workflowVersion,
        projectId: req.environment.project.id,
        organizationId: req.environment.organization.id,
        options: args.options,
        journal: req.journal,
      })
      // Keep the runtime stamp for downstream consumers that display
      // execution metadata. There is one supported runtime now.
      entry.runtime = "node"
      return entry
    },
    registerWaitpoint(args) {
      waitpoints.push(args)
    },
    pushMetadata(op) {
      metadataUpdates.push(op)
    },
    recordCompensable(args) {
      compensable.push(args)
    },
    compensableLength(): number {
      return compensable.length
    },
    spliceCompensable(fromIndex: number): Compensable[] {
      return compensable.splice(fromIndex)
    },
    pushStreamChunk(args) {
      const chunk = { ...args, at: now() }
      streamChunks.push(chunk)
      // Fire the live hook synchronously. Errors are swallowed — a
      // misbehaving subscriber must not break the workflow body.
      if (req.onStreamChunk) {
        try {
          req.onStreamChunk(chunk)
        } catch {
          /* ignore */
        }
      }
    },
  }

  const ctx = buildCtx({
    env: req.environment,
    journal: req.journal,
    callbacks,
    clock,
    random,
    retryOverride,
    services: req.services,
  })

  try {
    const output = await def.config.run(req.input, ctx)
    // If the body registered a waitpoint but a user try/catch swallowed
    // the internal yield signal, honour the waitpoint — the body can't
    // both register a waitpoint and complete in the same invocation.
    if (waitpoints.length > 0) {
      return { status: "waiting", waitpoints, metadataUpdates, journal: req.journal, streamChunks }
    }
    return { status: "completed", output, metadataUpdates, journal: req.journal, streamChunks }
  } catch (err) {
    if (isWaitpointPending(err)) {
      return { status: "waiting", waitpoints, metadataUpdates, journal: req.journal, streamChunks }
    }
    // Same guard for the error path: a swallowed signal shouldn't let
    // the body claim failure while waitpoints are pending.
    if (waitpoints.length > 0 && !isRunCancelled(err) && !isCompensateRequested(err)) {
      return { status: "waiting", waitpoints, metadataUpdates, journal: req.journal, streamChunks }
    }
    if (isRunCancelled(err)) {
      // Default: compensate on cancel. Terminal status stays `cancelled`
      // to reflect why the run ended.
      const compensations = await runCompensations(compensable, now)
      return {
        status: "cancelled",
        metadataUpdates,
        journal: req.journal,
        compensations,
        streamChunks,
      }
    }
    if (isCompensateRequested(err)) {
      const compensations = await runCompensations(compensable, now)
      const anyErr = compensations.some((c) => c.status === "err")
      return {
        status: anyErr ? "compensation_failed" : "compensated",
        compensations,
        metadataUpdates,
        journal: req.journal,
        streamChunks,
      }
    }

    // Uncaught user error. Run compensations LIFO; adjust terminal status
    // based on whether compensations were registered and all succeeded.
    const compensations = await runCompensations(compensable, now)
    const serialized = serializeError(err)

    if (compensations.length === 0) {
      return {
        status: "failed",
        error: serialized,
        metadataUpdates,
        journal: req.journal,
        streamChunks,
      }
    }

    const anyErr = compensations.some((c) => c.status === "err")
    return {
      status: anyErr ? "compensation_failed" : "compensated",
      error: serialized,
      compensations,
      metadataUpdates,
      journal: req.journal,
      streamChunks,
    }
  }
}

async function runCompensations(
  compensable: readonly Compensable[],
  now: () => number,
): Promise<CompensationReport[]> {
  const reports: CompensationReport[] = []
  // Reverse order: last-completed compensates first.
  for (let i = compensable.length - 1; i >= 0; i--) {
    const c = compensable[i]!
    const startedAt = now()
    try {
      await c.compensate(c.output)
      reports.push({ stepId: c.stepId, status: "ok", durationMs: now() - startedAt })
    } catch (err) {
      reports.push({
        stepId: c.stepId,
        status: "err",
        error: serializeError(err),
        durationMs: now() - startedAt,
      })
      // Continue with remaining compensations; don't abort on one failure.
    }
  }
  return reports
}

function serializeError(err: unknown): SerializedError {
  if (err instanceof Error) {
    const code = (err as { code?: string }).code
    const cause = (err as { cause?: unknown }).cause
    return {
      category: "USER_ERROR",
      code: typeof code === "string" ? code : "UNKNOWN",
      message: err.message,
      name: err.name,
      stack: err.stack,
      cause: cause !== undefined ? serializeError(cause) : undefined,
    }
  }
  return { category: "USER_ERROR", code: "UNKNOWN", message: String(err) }
}

async function acquireRateLimit(args: {
  spec: NonNullable<StepOptions<unknown>["rateLimit"]>
  stepId: string
  input: unknown
  runId: string
  projectId: string
  limiter: RateLimiter | undefined
  signal: AbortSignal
}): Promise<void> {
  const ctx = { run: { id: args.runId }, project: { id: args.projectId } }
  const key = typeof args.spec.key === "function" ? args.spec.key(args.input, ctx) : args.spec.key
  const limit =
    typeof args.spec.limit === "function" ? args.spec.limit(args.input) : args.spec.limit
  const units =
    args.spec.units === undefined
      ? 1
      : typeof args.spec.units === "function"
        ? args.spec.units(args.input)
        : args.spec.units
  const windowMs = durationToMs(args.spec.window)
  const onLimit = args.spec.onLimit ?? "queue"

  if (!args.limiter) {
    const e = new Error(
      `step "${args.stepId}" declared options.rateLimit but the handler has no rateLimiter wired; ` +
        `pass { rateLimiter } to createStepHandler()`,
    )
    ;(e as Error & { code?: string }).code = "RATE_LIMITER_MISSING"
    throw e
  }
  await args.limiter.acquire({ key, limit, units, windowMs, onLimit, signal: args.signal })
}

export type { RunStatus }
export { RunCancelledSignal, WaitpointPendingSignal }

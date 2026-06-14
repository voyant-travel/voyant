// The orchestrator's core loop.
//
// `driveUntilPaused` calls the tenant step handler repeatedly,
// merging each response into the run's journal, until the run is
// either terminal or parked on a waitpoint. It is deliberately free
// of persistence and transport — callers compose it with a
// `RunRecordStore` and a `StepHandler` (in-process or HTTP).
//
// See docs/runtime-protocol.md §2 + §5 for the wire semantics.

import { PROTOCOL_VERSION } from "@voyant-travel/workflows/protocol"
import type {
  JournalSlice,
  PendingWaitpoint,
  RunRecord,
  StepHandler,
  WaitpointInjection,
  WorkflowStepRequest,
  WorkflowStepResponse,
} from "./types.js"

export interface DriveOptions {
  handler: StepHandler
  /** Safety cap on invocations. Defaults to 128 — adjust upward for workloads with many waits. */
  maxInvocations?: number
  /** Injectable clock, ms since epoch. Defaults to Date.now. */
  now?: () => number
  /** Optional observer for tenant responses (logging/metrics hook). */
  onStepResponse?: (args: {
    runRecord: Readonly<RunRecord>
    response: WorkflowStepResponse
  }) => void
  /**
   * Resolve a RUN waitpoint by running a child workflow inline. When
   * unset, encountering a RUN waitpoint fails the parent with a clear
   * error. Callers that want `ctx.invoke` support wire this (usually
   * to the orchestrator's own `trigger`). Child runs inherit the
   * parent's tenantMeta unless the hook overrides.
   */
  triggerChild?: (args: {
    parent: Readonly<RunRecord>
    waitpoint: Readonly<PendingWaitpoint>
  }) => Promise<RunRecord>
  /**
   * Called between tenant invocations. Implementations typically
   * persist the record's mid-flight state and/or re-check the store
   * for external mutations (e.g. a concurrent `cancel()` call).
   *
   * Returning `false` stops the drive loop; the record's current
   * fields are what the caller will see. Return `true` to continue
   * with the next invocation.
   */
  beforeInvocation?: (rec: RunRecord) => Promise<boolean>
  /**
   * Per-run AbortSignal forwarded into every handler call. When
   * aborted mid-step (e.g. by a concurrent cancel), step bodies that
   * honor `ctx.signal` stop cleanly and the drive loop will observe
   * an aborted-status response on the current invocation.
   */
  signal?: AbortSignal
  /**
   * Live-chunk observer fired as each `ctx.stream.*` chunk is
   * produced — before the invocation returns. Plumbed through to
   * the handler's `opts.onStreamChunk`. Default: undefined (chunks
   * only arrive as part of the per-invocation response).
   */
  onStreamChunk?: (chunk: import("./types.js").StreamChunk) => void
}

/**
 * Drive a run forward. The passed-in record is mutated in place and
 * also returned so callers can write it back to the store in one
 * line: `await store.save(await driveUntilPaused(rec, opts))`.
 */
export async function driveUntilPaused(rec: RunRecord, opts: DriveOptions): Promise<RunRecord> {
  const maxInvocations = opts.maxInvocations ?? 128
  const now = opts.now ?? (() => Date.now())

  while (rec.invocationCount < maxInvocations) {
    if (isTerminal(rec.status)) break
    // Workflow-level timeout check. Compute-time-only: we compare
    // cumulative invocation duration, not wall-clock, so parked runs
    // don't starve their own budget while waiting on waitpoints.
    if (rec.timeoutMs !== undefined && rec.timeoutMs > 0 && rec.computeTimeMs >= rec.timeoutMs) {
      rec.status = "failed"
      rec.error = {
        category: "RUNTIME_ERROR",
        code: "WORKFLOW_TIMEOUT",
        message: `workflow exceeded its ${rec.timeoutMs}ms compute-time budget (${rec.computeTimeMs}ms used)`,
      }
      rec.completedAt = now()
      rec.pendingWaitpoints = []
      break
    }
    if (opts.beforeInvocation) {
      const go = await opts.beforeInvocation(rec)
      if (!go) break
      if (isTerminal(rec.status)) break
    }
    rec.invocationCount += 1
    const invocationStartedAt = now()
    const req = buildStepRequest(rec)

    const out = await opts.handler(req, {
      signal: opts.signal,
      onStreamChunk: opts.onStreamChunk,
    })
    rec.computeTimeMs += Math.max(0, now() - invocationStartedAt)
    if (out.status !== 200) {
      rec.status = "failed"
      rec.error = {
        category: "RUNTIME_ERROR",
        code: "handler_error",
        message: "message" in out.body ? out.body.message : `handler returned HTTP ${out.status}`,
      }
      rec.completedAt = now()
      break
    }
    const response = out.body as WorkflowStepResponse
    opts.onStepResponse?.({ runRecord: rec, response })
    applyResponse(rec, response, now)

    // Waiting with no pending waitpoints (all auto-resolved) is a
    // protocol error; we still break rather than loop forever.
    if (response.status === "waiting" && rec.pendingWaitpoints.length === 0) {
      rec.status = "failed"
      rec.error = {
        category: "RUNTIME_ERROR",
        code: "empty_waitpoint_list",
        message: "tenant returned status=waiting without any registered waitpoints",
      }
      rec.completedAt = now()
      break
    }

    // RUN waitpoints are resolvable inline via the triggerChild hook:
    // run each child to completion, write the result back on the
    // parent's journal, drop the RUN waitpoint, then loop.
    if (response.status === "waiting") {
      const runWaitpoints = rec.pendingWaitpoints.filter((w) => w.kind === "RUN")
      if (runWaitpoints.length > 0) {
        if (!opts.triggerChild) {
          rec.status = "failed"
          rec.error = {
            category: "RUNTIME_ERROR",
            code: "child_runs_unsupported",
            message:
              "workflow used ctx.invoke but the driver has no triggerChild hook wired. " +
              "Use orchestrator.trigger() from @voyant-travel/workflows-orchestrator, which wires children automatically.",
          }
          rec.completedAt = now()
          break
        }
        const resolvedRunIds = new Set<string>()
        try {
          for (const wp of runWaitpoints) {
            const childResolution = await resolveChildRun(rec, wp, opts.triggerChild, now)
            if (childResolution.kind === "resolved") {
              rec.journal.waitpointsResolved[wp.clientWaitpointId] = childResolution.entry
              resolvedRunIds.add(wp.clientWaitpointId)
            }
            // deferred → leave the RUN waitpoint pending; the child
            // will cascade-resume the parent on its terminal transition.
          }
        } catch (err) {
          rec.status = "failed"
          rec.error = {
            category: "RUNTIME_ERROR",
            code: "child_run_unresolvable",
            message: err instanceof Error ? err.message : String(err),
          }
          rec.completedAt = now()
          break
        }
        // Keep RUN waitpoints that are still deferred (child parked).
        rec.pendingWaitpoints = rec.pendingWaitpoints.filter(
          (w) => w.kind !== "RUN" || !resolvedRunIds.has(w.clientWaitpointId),
        )
        if (rec.pendingWaitpoints.length === 0) {
          rec.status = "running"
          // Loop continues → re-invoke with the resolved waitpoints in the journal.
          continue
        }
        // Still parked (non-RUN or deferred RUN); fall through to break.
      }
    }

    if (rec.status !== "running") break
  }

  if (rec.invocationCount >= maxInvocations && rec.status === "running") {
    rec.status = "failed"
    rec.error = {
      category: "RUNTIME_ERROR",
      code: "max_invocations_exceeded",
      message: `orchestrator drove the run ${maxInvocations} times without reaching a terminal or waiting state`,
    }
    rec.completedAt = now()
  }
  return rec
}

/**
 * Accept a waitpoint injection for a parked run: match it against
 * one of the pending waitpoints, write the resolution into the
 * journal, flip the run to "running", and leave it ready to be
 * re-driven by `driveUntilPaused`.
 */
export function applyWaitpointInjection(
  rec: RunRecord,
  injection: WaitpointInjection,
  now: () => number = () => Date.now(),
): { ok: true } | { ok: false; message: string } {
  if (rec.status !== "waiting") {
    return { ok: false, message: `run ${rec.id} is not parked (status: ${rec.status})` }
  }
  const matched = matchWaitpoint(rec.pendingWaitpoints, injection)
  if (!matched) {
    return {
      ok: false,
      message: `no pending waitpoint matches kind=${injection.kind}, key=${injectionKey(injection)}`,
    }
  }
  rec.journal.waitpointsResolved[matched.clientWaitpointId] = {
    kind: matched.kind,
    resolvedAt: now(),
    payload: injection.payload,
    source: "live",
    matchedEventId: injection.kind === "EVENT" ? `evt_live_${injection.eventType}` : undefined,
  }
  rec.pendingWaitpoints = rec.pendingWaitpoints.filter(
    (w) => w.clientWaitpointId !== matched.clientWaitpointId,
  )
  rec.status = "running"
  return { ok: true }
}

// ---- Internals ----

function buildStepRequest(rec: RunRecord): WorkflowStepRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    runId: rec.id,
    workflowId: rec.workflowId,
    workflowVersion: rec.workflowVersion,
    invocationCount: rec.invocationCount,
    input: rec.input,
    journal: rec.journal,
    environment: rec.environment,
    // Deadlines aren't enforced yet in the reference orchestrator; the
    // handler accepts the field for forward-compat.
    deadline: Number.MAX_SAFE_INTEGER,
    tenantMeta: rec.tenantMeta,
    runMeta: {
      number: rec.runMeta.number,
      attempt: rec.runMeta.attempt,
      triggeredBy: rec.triggeredBy,
      tags: rec.tags,
      startedAt: rec.startedAt,
    },
  }
}

function applyResponse(rec: RunRecord, response: WorkflowStepResponse, now: () => number): void {
  // Snapshot the metadata state from the prior invocation. The
  // response journal is a clone of what we sent in, so its
  // metadataState field won't reflect mutations the body just made —
  // those come in `metadataUpdates`. We keep the prior state, apply
  // the delta, then swap in the new journal shape.
  const priorMetadata = rec.journal.metadataState

  // The handler returned the executor's journal post-invocation —
  // trust it as the new source of truth for steps / waitpoints /
  // compensations. We deep-clone to isolate from future executor
  // mutations.
  rec.journal = structuredClone(response.journal) as JournalSlice
  rec.journal.metadataState = { ...priorMetadata }

  // Apply only the delta of metadata mutations. Each invocation's
  // response re-emits every mutation the body made — including those
  // from prior invocations, since the body replays from the start.
  // The positional cursor on rec.metadataAppliedCount dedups them.
  const newMutations = response.metadataUpdates.slice(rec.metadataAppliedCount)
  applyMetadataUpdates(rec.journal.metadataState, newMutations)
  rec.metadataAppliedCount = response.metadataUpdates.length

  // Accumulate stream chunks across invocations, grouped by streamId.
  // Each response carries only chunks emitted in that invocation.
  for (const chunk of response.streamChunks) {
    const bucket = rec.streams[chunk.streamId] ?? []
    rec.streams[chunk.streamId] = bucket
    bucket.push({ ...chunk })
  }

  if (response.status === "completed") {
    rec.status = "completed"
    rec.output = response.output
    rec.completedAt = now()
    rec.pendingWaitpoints = []
    return
  }
  if (response.status === "failed") {
    rec.status = "failed"
    rec.error = {
      category: response.error.category,
      code: response.error.code,
      message: response.error.message,
    }
    rec.completedAt = now()
    rec.pendingWaitpoints = []
    return
  }
  if (response.status === "cancelled") {
    rec.status = "cancelled"
    rec.completedAt = now()
    rec.pendingWaitpoints = []
    return
  }
  if (response.status === "compensated" || response.status === "compensation_failed") {
    rec.status = response.status
    if (response.error) {
      rec.error = {
        category: response.error.category,
        code: response.error.code,
        message: response.error.message,
      }
    }
    rec.completedAt = now()
    rec.pendingWaitpoints = []
    return
  }
  // "waiting"
  rec.status = "waiting"
  const parkedAt = now()
  rec.pendingWaitpoints = response.waitpoints.map<PendingWaitpoint>((w) => {
    const meta = { ...w.meta }
    // Stamp wall-clock wake times on DATETIME waitpoints at park time,
    // so alarm loops (local serve + CF DO) can fire at the right moment
    // without re-deriving wall-clock from wherever the run is stored.
    if (w.kind === "DATETIME" && typeof meta.wakeAt !== "number") {
      const durationMs = w.timeoutMs ?? (typeof meta.durationMs === "number" ? meta.durationMs : 0)
      meta.wakeAt = parkedAt + durationMs
    }
    return {
      clientWaitpointId: w.clientWaitpointId,
      kind: w.kind,
      meta,
      timeoutMs: w.timeoutMs,
    }
  })
}

function isTerminal(status: RunRecord["status"]): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "compensated" ||
    status === "compensation_failed"
  )
}

function matchWaitpoint(
  pending: readonly PendingWaitpoint[],
  inj: WaitpointInjection,
): PendingWaitpoint | undefined {
  for (const wp of pending) {
    if (wp.kind !== inj.kind) continue
    if (inj.kind === "EVENT" && wp.meta.eventType === inj.eventType) return wp
    if (inj.kind === "SIGNAL" && wp.meta.signalName === inj.name) return wp
    if (inj.kind === "MANUAL" && wp.meta.tokenId === inj.tokenId) return wp
  }
  return undefined
}

function injectionKey(inj: WaitpointInjection): string {
  if (inj.kind === "EVENT") return inj.eventType
  if (inj.kind === "SIGNAL") return inj.name
  return inj.tokenId
}

type ChildResolution =
  | {
      kind: "resolved"
      entry: import("@voyant-travel/workflows/protocol").WaitpointResolutionEntry
    }
  | { kind: "deferred" }

async function resolveChildRun(
  parent: RunRecord,
  wp: PendingWaitpoint,
  triggerChild: NonNullable<DriveOptions["triggerChild"]>,
  now: () => number,
): Promise<ChildResolution> {
  const childRecord = await triggerChild({ parent, waitpoint: wp })
  const at = now()
  if (wp.meta.detach === true) {
    return {
      kind: "resolved",
      entry: {
        kind: "RUN",
        resolvedAt: at,
        payload: undefined,
        source: "replay",
      },
    }
  }
  if (childRecord.status === "completed") {
    return {
      kind: "resolved",
      entry: {
        kind: "RUN",
        resolvedAt: at,
        payload: childRecord.output,
        source: "replay",
      },
    }
  }
  if (childRecord.status === "waiting") {
    // Child parked on its own waitpoint(s). The parent parks too; the
    // child's parent pointer (set by trigger's driveOptionsFor) will
    // cascade-resume the parent when the child later reaches a
    // terminal state via resume/cancel/alarm.
    return { kind: "deferred" }
  }
  // Failed / cancelled / compensated / compensation_failed → surface as error.
  const errMsg = childRecord.error?.message ?? `child run ended with status ${childRecord.status}`
  const errCode = childRecord.error?.code ?? "CHILD_RUN_ENDED"
  return {
    kind: "resolved",
    entry: {
      kind: "RUN",
      resolvedAt: at,
      source: "replay",
      error: {
        category:
          (childRecord.error?.category as "USER_ERROR" | "RUNTIME_ERROR" | undefined) ??
          "USER_ERROR",
        code: errCode,
        message: errMsg,
      },
    },
  }
}

interface MetadataMutation {
  op: "set" | "increment" | "append" | "remove"
  key: string
  value?: unknown
  target?: "self" | "parent" | "root"
}

function applyMetadataUpdates(
  state: Record<string, unknown>,
  updates: readonly MetadataMutation[],
): void {
  for (const u of updates) {
    switch (u.op) {
      case "set":
        state[u.key] = u.value
        break
      case "increment": {
        const cur = typeof state[u.key] === "number" ? (state[u.key] as number) : 0
        state[u.key] = cur + ((u.value as number) ?? 1)
        break
      }
      case "append": {
        const cur = Array.isArray(state[u.key]) ? (state[u.key] as unknown[]) : []
        state[u.key] = [...cur, u.value]
        break
      }
      case "remove":
        delete state[u.key]
        break
    }
  }
}

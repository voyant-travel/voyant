// agent-quality: file-size exception -- owner: workflows-orchestrator; existing module stays co-located until a dedicated split preserves behavior and tests.
// Public entry points for the reference orchestrator.
//
// `trigger()` creates a RunRecord, drives it forward through the
// tenant handler, and persists the resulting record.
// `resume()` accepts a waitpoint injection for a parked run, applies
// it, drives forward, and persists.
// `cancel()` closes out a run without running compensations (they
// must come from the tenant handler, not the orchestrator).

import type { Duration } from "@voyantjs/workflows"

import { registerRunAbort, signalRunAbort, unregisterRunAbort } from "./abort-registry.js"
import { applyWaitpointInjection, type DriveOptions, driveUntilPaused } from "./drive.js"
import { emptyJournal } from "./journal-helpers.js"
import type {
  JournalSlice,
  RunRecord,
  RunRecordStore,
  RunTrigger,
  StepHandler,
  WaitpointInjection,
} from "./types.js"

export interface TriggerArgs {
  workflowId: string
  workflowVersion: string
  input: unknown
  tenantMeta: RunRecord["tenantMeta"]
  environment?: RunRecord["environment"]
  triggeredBy?: RunTrigger
  tags?: string[]
  runNumber?: number
  /** Optional id to use; defaults to `run_` + crypto random. */
  runId?: string
  /**
   * Caller-supplied idempotency token. When set and the caller did not
   * explicitly pass `runId`, the orchestrator derives a deterministic
   * runId from `(workflowId, idempotencyKey)` so retries of the same
   * trigger return the same run record without re-driving. The key is
   * also persisted onto `RunRecord.idempotencyKey` so persistent stores
   * can populate dedup columns / unique indexes natively.
   *
   * See architecture doc §15.2 for the full ingest-side derivation
   * (eventId → idempotencyKey via `${filterId}:${eventId}`).
   */
  idempotencyKey?: string
  /**
   * Optional trigger-time delay. When set to a future instant, the
   * orchestrator persists the run in `waiting` on a synthetic DATETIME
   * waitpoint and leaves execution to the normal wakeup/time-wheel path.
   */
  delay?: Duration | Date
  /** Higher values are claimed first by scheduler/time-wheel stores. */
  priority?: number
  /**
   * Optional journal seed. Used by external replay/resume callers
   * that need a new run to skip steps already completed by a parent
   * run.
   */
  initialJournal?: JournalSlice
  /**
   * Metadata cursor paired with `initialJournal`. Resume callers that
   * seed a journal with an existing `metadataState` must also seed the
   * positional cursor so replayed metadata mutations are not applied
   * twice.
   */
  initialMetadataAppliedCount?: number
  /**
   * Compute-time budget in ms, typically from `WorkflowConfig.timeout`.
   * Parked time on waitpoints does not count against this. When the
   * cumulative invocation time exceeds it, the run ends `failed`
   * with `code: "WORKFLOW_TIMEOUT"`. Undefined / 0 = no limit.
   */
  timeoutMs?: number
  /**
   * For child runs spawned by `ctx.invoke` on a parent that may park.
   * When set, the orchestrator records it on the child's record so
   * the child's terminal status cascade-resumes the parent.
   */
  parent?: { runId: string; waitpointId: string }
  /**
   * Internal lifecycle hook used by driver-level coordinators that need
   * the persisted run id before the first invocation starts.
   */
  onRunRecordCreated?: (record: RunRecord) => void
}

export interface OrchestratorDeps extends DriveOptions {
  store: RunRecordStore
  handler: StepHandler
  /** id generator; defaults to `run_<random>`. */
  idGenerator?: () => string
}

export async function trigger(args: TriggerArgs, deps: OrchestratorDeps): Promise<RunRecord> {
  const now = deps.now ?? (() => Date.now())
  const createdAt = now()
  // Idempotency: caller-supplied `runId` wins (explicit). Otherwise, when
  // `idempotencyKey` is supplied, derive a deterministic runId from
  // `(workflowId, idempotencyKey)`. We then route through `store.tryInsert`
  // — atomic check-or-insert — so concurrent triggers with the same
  // derived runId never both proceed to drive (architecture doc §15.2,
  // closes the race the get-then-save pattern leaves open).
  const explicitRunId = args.runId
  const idempotencyKey = args.idempotencyKey
  const derivedRunId =
    idempotencyKey !== undefined ? `idem-${args.workflowId}-${idempotencyKey}` : undefined
  const id = explicitRunId ?? derivedRunId ?? deps.idGenerator?.() ?? defaultRunId(now)
  const isIdempotent = explicitRunId !== undefined || derivedRunId !== undefined
  const delayWakeAt = resolveDelayWakeAt(args.delay, createdAt)
  const record: RunRecord = {
    id,
    workflowId: args.workflowId,
    workflowVersion: args.workflowVersion,
    status: delayWakeAt !== undefined ? "waiting" : "running",
    input: args.input,
    journal: args.initialJournal ? cloneJournal(args.initialJournal) : emptyJournal(),
    invocationCount: 0,
    metadataAppliedCount: args.initialMetadataAppliedCount ?? 0,
    computeTimeMs: 0,
    timeoutMs: args.timeoutMs,
    priority: args.priority,
    parent: args.parent,
    pendingWaitpoints:
      delayWakeAt !== undefined
        ? [
            {
              clientWaitpointId: triggerDelayWaitpointId(id),
              kind: "DATETIME",
              meta: {
                wakeAt: delayWakeAt,
                durationMs: Math.max(0, delayWakeAt - createdAt),
                source: "trigger.delay",
              },
            },
          ]
        : [],
    streams: {},
    startedAt: delayWakeAt ?? createdAt,
    triggeredBy: args.triggeredBy ?? { kind: "api" },
    tags: args.tags ?? [],
    environment: args.environment ?? "development",
    tenantMeta: args.tenantMeta,
    runMeta: { number: args.runNumber ?? 1, attempt: 1 },
    idempotencyKey,
  }
  // Idempotent path uses tryInsert; non-idempotent (auto-generated) ids
  // can't collide so the existing save() is sufficient.
  if (isIdempotent) {
    const result = await deps.store.tryInsert(record)
    if (!result.created) {
      // Another caller raced in first. Return their record without
      // re-driving — drive() is what actually fires side effects.
      return result.record
    }
    args.onRunRecordCreated?.(record)
  } else {
    // Persist up-front so concurrent `cancel(runId)` calls can find the
    // run before any invocation has completed.
    await deps.store.save(record)
    args.onRunRecordCreated?.(record)
  }
  if (delayWakeAt !== undefined) {
    return record
  }
  const abortCtrl = registerRunAbort(id)
  try {
    await driveUntilPaused(record, {
      ...driveOptionsFor(deps),
      signal: abortCtrl.signal,
    })
  } finally {
    unregisterRunAbort(id)
  }
  // If an external cancel fired during drive, the aborted step may
  // have surfaced as `failed` (the step threw on abort). The user's
  // intent was cancel, so adopt the store's `cancelled` status.
  if (abortCtrl.signal.aborted) {
    const latest = await deps.store.get(id)
    if (latest?.status === "cancelled") {
      record.status = "cancelled"
      record.completedAt = latest.completedAt ?? now()
      record.pendingWaitpoints = []
      record.error = latest.error
    }
  }
  return deps.store.save(record)
}

function resolveDelayWakeAt(delay: Duration | Date | undefined, now: number): number | undefined {
  if (delay === undefined) return undefined
  const wakeAt = delay instanceof Date ? delay.getTime() : now + durationToMs(delay)
  return wakeAt > now ? wakeAt : undefined
}

function durationToMs(duration: Duration): number {
  if (typeof duration === "number") return duration
  const m = /^(\d+)(ms|s|m|h|d|w)$/.exec(duration)
  if (!m) throw new Error(`invalid duration: ${String(duration)}`)
  const n = Number(m[1])
  switch (m[2]) {
    case "ms":
      return n
    case "s":
      return n * 1_000
    case "m":
      return n * 60_000
    case "h":
      return n * 3_600_000
    case "d":
      return n * 86_400_000
    case "w":
      return n * 604_800_000
    default:
      throw new Error(`invalid duration unit: ${m[2]}`)
  }
}

function triggerDelayWaitpointId(runId: string): string {
  return `trigger-delay:${runId}`
}

function cloneJournal(journal: JournalSlice): JournalSlice {
  return structuredClone(journal) as JournalSlice
}

/**
 * Build DriveOptions that carry a `triggerChild` hook bound to the
 * same deps — so `ctx.invoke(child, ...)` recursively runs the child
 * through the same orchestrator, store, and handler — plus a
 * `beforeInvocation` hook that persists mid-flight progress and
 * honors concurrent cancellations.
 */
function driveOptionsFor(deps: OrchestratorDeps): DriveOptions {
  const now = deps.now ?? (() => Date.now())
  return {
    ...deps,
    triggerChild: async ({ parent, waitpoint }) => {
      const childWorkflowId = String(waitpoint.meta.childWorkflowId)
      const childInput = waitpoint.meta.childInput
      const detach = waitpoint.meta.detach === true
      return trigger(
        {
          workflowId: childWorkflowId,
          // Children inherit the parent's workflow version slot unless
          // lockToVersion is set; for v1 we always inherit.
          workflowVersion: parent.workflowVersion,
          input: childInput,
          tenantMeta: parent.tenantMeta,
          environment: parent.environment,
          // Inherit the parent's trigger kind for run-tree observability.
          triggeredBy: parent.triggeredBy,
          tags: Array.isArray(waitpoint.meta.tags) ? (waitpoint.meta.tags as string[]) : [],
          // Lineage pointer: if this child parks, its terminal status
          // cascade-resumes the parent at this specific waitpoint.
          parent: detach
            ? undefined
            : { runId: parent.id, waitpointId: waitpoint.clientWaitpointId },
        },
        deps,
      )
    },
    beforeInvocation: async (rec) => {
      // Read-first: a concurrent `cancel()` may have flipped the
      // stored status. If we saved first, we'd overwrite it.
      const latest = await deps.store.get(rec.id)
      if (latest && latest.status === "cancelled") {
        rec.status = "cancelled"
        rec.completedAt = latest.completedAt ?? now()
        rec.pendingWaitpoints = []
        if (latest.error) rec.error = latest.error
        return false
      }
      // Persist mid-flight progress so the dashboard sees updates and
      // the next concurrent cancel() has an up-to-date target.
      await deps.store.save(rec)
      return true
    },
  }
}

export interface ResumeArgs {
  runId: string
  injection: WaitpointInjection
}

export async function resume(
  args: ResumeArgs,
  deps: OrchestratorDeps,
): Promise<
  | { ok: true; record: RunRecord }
  | { ok: false; status: "not_found" | "not_parked" | "no_match"; message: string }
> {
  const existing = await deps.store.get(args.runId)
  if (!existing) {
    return { ok: false, status: "not_found", message: `run ${args.runId} not found` }
  }
  if (existing.status !== "waiting") {
    return {
      ok: false,
      status: "not_parked",
      message: `run ${args.runId} is not parked (status: ${existing.status})`,
    }
  }
  const ok = applyWaitpointInjection(existing, args.injection, deps.now)
  if (!ok.ok) {
    return { ok: false, status: "no_match", message: ok.message }
  }
  const abortCtrl = registerRunAbort(existing.id)
  try {
    await driveUntilPaused(existing, {
      ...driveOptionsFor(deps),
      signal: abortCtrl.signal,
    })
  } finally {
    unregisterRunAbort(existing.id)
  }
  if (abortCtrl.signal.aborted) {
    const latest = await deps.store.get(existing.id)
    if (latest?.status === "cancelled") {
      const now = deps.now ?? (() => Date.now())
      existing.status = "cancelled"
      existing.completedAt = latest.completedAt ?? now()
      existing.pendingWaitpoints = []
      existing.error = latest.error
    }
  }
  const saved = await deps.store.save(existing)
  // If this resume drove the run into a terminal state and it's a
  // child of some parent, cascade the resolution.
  if (isTerminalStatus(saved.status)) {
    await cascadeResumeParent(saved, deps)
  }
  return { ok: true, record: saved }
}

export interface ResumeDueAlarmsArgs {
  runId: string
}

/**
 * Resolve every DATETIME waitpoint whose `wakeAt` has passed, drive
 * the run forward, and persist. Returns the saved record, or null
 * when the run isn't in `waiting` state (already terminal / running
 * elsewhere), or when no DATETIME waitpoints are actually due yet —
 * both are no-ops that the caller can treat as "nothing to do."
 *
 * Callers (local serve loop, CF DO alarm handler) are responsible for
 * scheduling the actual wake-up timer. This function is transport-
 * agnostic: given `now()`, it does the resolve + drive + save.
 */
export async function resumeDueAlarms(
  args: ResumeDueAlarmsArgs,
  deps: OrchestratorDeps,
): Promise<RunRecord | null> {
  const record = await deps.store.get(args.runId)
  if (!record) return null
  if (record.status !== "waiting") return null
  const now = deps.now ?? (() => Date.now())
  const at = now()
  const stillPending: typeof record.pendingWaitpoints = []
  let resolvedAny = false
  for (const wp of record.pendingWaitpoints) {
    const wakeAt = typeof wp.meta.wakeAt === "number" ? wp.meta.wakeAt : undefined
    if (wp.kind === "DATETIME" && wakeAt !== undefined && wakeAt <= at) {
      record.journal.waitpointsResolved[wp.clientWaitpointId] = {
        kind: "DATETIME",
        resolvedAt: at,
        source: "replay",
      }
      resolvedAny = true
    } else {
      stillPending.push(wp)
    }
  }
  if (!resolvedAny) return null
  record.pendingWaitpoints = stillPending
  if (record.pendingWaitpoints.length === 0) record.status = "running"
  const abortCtrl = registerRunAbort(record.id)
  try {
    await driveUntilPaused(record, {
      ...driveOptionsFor(deps),
      signal: abortCtrl.signal,
    })
  } finally {
    unregisterRunAbort(record.id)
  }
  const saved = await deps.store.save(record)
  if (isTerminalStatus(saved.status)) {
    await cascadeResumeParent(saved, deps)
  }
  return saved
}

export interface CancelArgs {
  runId: string
  reason?: string
}

export async function cancel(
  args: CancelArgs,
  deps: OrchestratorDeps,
): Promise<
  | { ok: true; record: RunRecord }
  | { ok: false; status: "not_found" | "already_terminal"; message: string }
> {
  const existing = await deps.store.get(args.runId)
  if (!existing) {
    return { ok: false, status: "not_found", message: `run ${args.runId} not found` }
  }
  if (existing.status !== "waiting" && existing.status !== "running") {
    return {
      ok: false,
      status: "already_terminal",
      message: `run ${args.runId} is already terminal (status: ${existing.status})`,
    }
  }
  const now = deps.now ?? (() => Date.now())
  existing.status = "cancelled"
  existing.completedAt = now()
  existing.pendingWaitpoints = []
  if (args.reason) {
    existing.error = {
      category: "USER_ERROR",
      code: "CANCELLED",
      message: args.reason,
    }
  }
  const saved = await deps.store.save(existing)
  // Best-effort mid-step abort: if the run is in-flight in this
  // process, fire its AbortSignal so step bodies that observe
  // `ctx.signal` (fetches, sleeps, etc.) stop immediately. Returns
  // `false` when no controller is registered (run is in another
  // process, or drive has already exited) — that's fine; the
  // status flip + between-invocation recheck cover that path.
  signalRunAbort(existing.id, args.reason)
  // If this cancel was on a child with a parked parent, surface the
  // cancellation to the parent as a RUN-waitpoint error.
  if (isTerminalStatus(saved.status)) {
    await cascadeResumeParent(saved, deps)
  }
  return { ok: true, record: saved }
}

/**
 * When a child run reaches a terminal state, look up its `parent`
 * pointer and resume the parent's matching RUN waitpoint with the
 * child's output / error. Best-effort: if the parent can't be found
 * or is no longer parked, silently drop (the parent's own drive will
 * observe the child's state on replay via a subsequent trigger).
 */
async function cascadeResumeParent(child: RunRecord, deps: OrchestratorDeps): Promise<void> {
  if (!child.parent) return
  const parent = await deps.store.get(child.parent.runId)
  if (!parent) return
  if (parent.status !== "waiting") return
  const wpIdx = parent.pendingWaitpoints.findIndex(
    (w) => w.clientWaitpointId === child.parent!.waitpointId,
  )
  if (wpIdx < 0) return

  const now = deps.now ?? (() => Date.now())
  const at = now()
  if (child.status === "completed") {
    parent.journal.waitpointsResolved[child.parent.waitpointId] = {
      kind: "RUN",
      resolvedAt: at,
      payload: child.output,
      source: "replay",
    }
  } else {
    parent.journal.waitpointsResolved[child.parent.waitpointId] = {
      kind: "RUN",
      resolvedAt: at,
      source: "replay",
      error: {
        category:
          (child.error?.category as "USER_ERROR" | "RUNTIME_ERROR" | undefined) ?? "USER_ERROR",
        code: child.error?.code ?? "CHILD_RUN_ENDED",
        message: child.error?.message ?? `child run ended with status ${child.status}`,
      },
    }
  }
  parent.pendingWaitpoints.splice(wpIdx, 1)
  if (parent.pendingWaitpoints.length === 0) {
    parent.status = "running"
  }

  // Re-drive the parent. This nested drive goes through the same
  // handler / store / hooks, so the parent's own parent (if any)
  // will also cascade-resume when appropriate.
  const abortCtrl = registerRunAbort(parent.id)
  try {
    await driveUntilPaused(parent, {
      ...driveOptionsFor(deps),
      signal: abortCtrl.signal,
    })
  } finally {
    unregisterRunAbort(parent.id)
  }
  await deps.store.save(parent)
  // The parent might itself have a parent — recurse.
  if (isTerminalStatus(parent.status)) {
    await cascadeResumeParent(parent, deps)
  }
}

function isTerminalStatus(s: string): boolean {
  return (
    s === "completed" ||
    s === "failed" ||
    s === "cancelled" ||
    s === "compensated" ||
    s === "compensation_failed"
  )
}

function defaultRunId(now: () => number): string {
  const ts = now().toString(36)
  // Non-cryptographic; orchestrator core exposes `idGenerator` for
  // callers that want stronger guarantees.
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .padStart(4, "0")
  return `run_${ts}_${rand}`
}

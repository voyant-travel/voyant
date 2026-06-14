// @voyant-travel/workflows/testing
//
// In-process test harness with mocked steps, waits, and invokes.
// Contract in docs/sdk-surface.md §11.
// agent-quality: file-size exception -- legacy test harness stays co-located until pause/resume helpers are split.
//
// Drives `executeWorkflowStep` across resumptions. Steps resolve
// from a user-supplied stub map; waitpoints resolve from fixtures.

import type { SerializedError } from "../protocol/index.js"
import {
  type CompensationReport,
  type ExecuteWorkflowStepResponse,
  executeWorkflowStep,
  type MetadataMutation,
  type StreamChunk,
  type WaitpointRegistration,
} from "../runtime/executor.js"
import type {
  JournalSlice,
  StepJournalEntry,
  WaitpointResolutionEntry,
} from "../runtime/journal.js"
import { emptyJournal } from "../runtime/journal.js"
import type { RunStatus } from "../types.js"
import type {
  EnvironmentContext,
  MetadataValue,
  StepContext,
  WorkflowDefinition,
  WorkflowHandle,
} from "../workflow.js"
import { getWorkflow } from "../workflow.js"

function workflowForExecutor<TIn, TOut>(def: WorkflowDefinition<TIn, TOut>): WorkflowDefinition {
  return def as WorkflowDefinition
}

export interface TestOptions<_TIn> {
  /** Map of stepId → function run in place of the real step body. */
  steps?: Record<string, (stepCtx: StepContext) => unknown | Promise<unknown>>
  /**
   * Map of eventType → payload (or payload array). First
   * match-per-eventType wins.
   */
  waitForEvent?: Record<string, unknown | unknown[]>
  /** Map of signalName → payload. */
  waitForSignal?: Record<string, unknown>
  /** Map of tokenId → payload. */
  waitForToken?: Record<string, unknown>
  /** Workflow invoke stubs keyed by child workflow id. */
  invoke?: Record<string, unknown>
  /** Fake env bindings, passed through to `ctx.environment` for tests. */
  env?: Record<string, unknown>
  environment?: Partial<EnvironmentContext>
  /** Fixed wall-clock basis for the run. Defaults to Date.now(). */
  now?: () => number
  random?: () => number
  /** Max resumption cycles. Defaults to 16 — guards runaway loops. */
  maxInvocations?: number
  /**
   * When true, the harness stops and returns a "waiting" TestResult as
   * soon as any registered waitpoint has no fixture resolution (instead
   * of throwing). Callers can then persist the run and resume it later
   * via `resumeWorkflowForTest` once the waitpoint is resolved from a
   * live source (e.g. a dashboard HTTP injection).
   *
   * DATETIME waitpoints (sleeps) are always auto-resolved regardless of
   * this flag, since a local dev loop is not the right place to
   * synthesize wall-clock delays.
   */
  pauseOnWait?: boolean
}

export interface TestResult<TOut> {
  status: Extract<
    RunStatus,
    "completed" | "failed" | "cancelled" | "compensated" | "compensation_failed" | "waiting"
  >
  output?: TOut
  error?: { category: SerializedError["category"]; code: string; message: string }
  steps: { id: string; status: "ok" | "err" | "skipped"; duration: number; output?: unknown }[]
  events: { type: string; at: number; data: unknown }[]
  metadata: Record<string, MetadataValue>
  compensations: CompensationReport[]
  /** Chunks emitted via `ctx.stream()` / `ctx.stream.{text,json,bytes}`, grouped by streamId in emission order. */
  streams: Record<string, StreamChunk[]>
  invocations: number
  /**
   * Populated when `status === "waiting"`. Holds the persisted executor
   * state needed to resume the run via `resumeWorkflowForTest`.
   */
  pause?: {
    journal: JournalSlice
    pendingWaitpoints: WaitpointRegistration[]
    startedAt: number
    invocationCount: number
    metadataAppliedCount: number
    fixtureCursors: { event: Record<string, number>; signal: Record<string, number> }
  }
}

export async function runWorkflowForTest<TIn, TOut>(
  workflow: WorkflowHandle<TIn, TOut>,
  input: TIn,
  opts: TestOptions<TIn> = {},
): Promise<TestResult<TOut>> {
  const def = workflow as WorkflowDefinition<TIn, TOut>
  const now = opts.now ?? (() => Date.now())
  const startedAt = now()
  const journal: JournalSlice = emptyJournal()
  const metadata: Record<string, MetadataValue> = {}
  const events: TestResult<TOut>["events"] = []
  const streams: Record<string, StreamChunk[]> = {}
  const maxInvocations = opts.maxInvocations ?? 16

  const environment: EnvironmentContext = {
    name: opts.environment?.name ?? "development",
    git: opts.environment?.git,
  }

  let invocationCount = 0
  let last: ExecuteWorkflowStepResponse | undefined
  // Track how many metadata mutations have already been applied so we
  // only apply the delta on each invocation. Otherwise replays
  // double-count `increment` / duplicate `append` values. (Positional
  // dedup; mirrors what the real orchestrator does with journaled ids.)
  let metadataAppliedCount = 0
  // Per-fixture cursors into iterable event/signal arrays, persisted
  // across invocations so replay doesn't restart consumption.
  const cursors: FixtureCursors = { event: new Map(), signal: new Map() }

  while (invocationCount < maxInvocations) {
    invocationCount += 1

    const response = await executeWorkflowStep(workflowForExecutor(def), {
      runId: `run_test_${def.id}`,
      workflowId: def.id,
      workflowVersion: "test",
      input,
      journal,
      invocationCount,
      environment: {
        run: {
          id: `run_test_${def.id}`,
          number: 1,
          attempt: 1,
          triggeredBy: { kind: "api" },
          tags: [],
          startedAt,
        },
        workflow: { id: def.id, version: "test" },
        environment,
        project: { id: "prj_test", slug: "test" },
        organization: { id: "org_test", slug: "test" },
      },
      triggeredBy: { kind: "api" },
      runStartedAt: startedAt,
      tags: [],
      stepRunner: createStepRunner(opts, events, now),
    })

    last = response

    const newMutations = response.metadataUpdates.slice(metadataAppliedCount)
    applyMetadata(metadata, newMutations)
    metadataAppliedCount = response.metadataUpdates.length

    for (const chunk of response.streamChunks) {
      const bucket = streams[chunk.streamId] ?? []
      streams[chunk.streamId] = bucket
      bucket.push(chunk)
    }

    if (response.status === "completed") {
      return {
        status: "completed",
        output: response.output as TOut,
        steps: stepsFromJournal(journal),
        events,
        metadata,
        compensations: [],
        streams,
        invocations: invocationCount,
      }
    }

    if (response.status === "failed") {
      return {
        status: "failed",
        error: {
          category: response.error.category,
          code: response.error.code,
          message: response.error.message,
        },
        steps: stepsFromJournal(journal),
        events,
        metadata,
        compensations: [],
        streams,
        invocations: invocationCount,
      }
    }

    if (response.status === "cancelled") {
      return {
        status: "cancelled",
        steps: stepsFromJournal(journal),
        events,
        metadata,
        compensations: response.compensations,
        streams,
        invocations: invocationCount,
      }
    }

    if (response.status === "compensated" || response.status === "compensation_failed") {
      return {
        status: response.status,
        error: response.error
          ? {
              category: response.error.category,
              code: response.error.code,
              message: response.error.message,
            }
          : undefined,
        steps: stepsFromJournal(journal),
        events,
        metadata,
        compensations: response.compensations,
        streams,
        invocations: invocationCount,
      }
    }

    // Waiting: resolve waitpoints from fixtures and loop. Waitpoints
    // that have no fixture match either throw (default) or, when
    // `pauseOnWait` is set, park the run and return a "waiting" result.
    const stillPending: WaitpointRegistration[] = []
    for (const wp of response.waitpoints) {
      const resolved = await resolveWaitpoint(wp, opts, now, events, cursors)
      if (!resolved) {
        if (opts.pauseOnWait) {
          stillPending.push(wp)
          continue
        }
        throw new Error(
          `test harness: waitpoint ${wp.clientWaitpointId} (${wp.kind}) has no fixture resolution. ` +
            `Provide one via TestOptions.waitForEvent / waitForSignal / (sleeps auto-resolve), ` +
            `or set TestOptions.pauseOnWait to park the run.`,
        )
      }
      journal.waitpointsResolved[wp.clientWaitpointId] = resolved
      events.push({
        type: `waitpoint.resolved:${wp.kind}`,
        at: resolved.resolvedAt,
        data: resolved.payload ?? null,
      })
    }
    if (stillPending.length > 0) {
      return {
        status: "waiting",
        steps: stepsFromJournal(journal),
        events,
        metadata,
        compensations: [],
        streams,
        invocations: invocationCount,
        pause: {
          journal,
          pendingWaitpoints: stillPending,
          startedAt,
          invocationCount,
          metadataAppliedCount,
          fixtureCursors: {
            event: Object.fromEntries(cursors.event.entries()),
            signal: Object.fromEntries(cursors.signal.entries()),
          },
        },
      }
    }
  }

  throw new Error(
    `test harness exceeded maxInvocations (${maxInvocations}). ` +
      `Last status: ${last?.status ?? "<none>"}. Possible infinite waitpoint loop.`,
  )
}

/**
 * A single injected waitpoint resolution — the tenant-side analogue of
 * the orchestrator delivering an event, signal, or token payload to a
 * parked run. The matcher (`kind` + `key`) identifies which pending
 * waitpoint to resolve; `payload` is the value surfaced to the body.
 */
export type WaitpointInjection =
  | { kind: "EVENT"; eventType: string; payload?: unknown }
  | { kind: "SIGNAL"; name: string; payload?: unknown }
  | { kind: "MANUAL"; tokenId: string; payload?: unknown }

export interface ResumeOptions<TIn> extends TestOptions<TIn> {
  /** Persisted pause state returned from a previous `runWorkflowForTest` or `resumeWorkflowForTest`. */
  pause: NonNullable<TestResult<unknown>["pause"]>
  /** The single waitpoint resolution to inject on resume. */
  injection: WaitpointInjection
}

/**
 * Resume a parked run. Matches the injection against one of the
 * `pause.pendingWaitpoints`, records it in the journal, and re-enters
 * the executor loop until the next pause or terminal state.
 */
export async function resumeWorkflowForTest<TIn, TOut>(
  workflow: WorkflowHandle<TIn, TOut>,
  input: TIn,
  opts: ResumeOptions<TIn>,
): Promise<TestResult<TOut>> {
  const def = workflow as WorkflowDefinition<TIn, TOut>
  const now = opts.now ?? (() => Date.now())
  const maxInvocations = opts.maxInvocations ?? 16

  const matched = matchWaitpoint(opts.pause.pendingWaitpoints, opts.injection)
  if (!matched) {
    throw new Error(
      `resume: no pending waitpoint matches injection kind=${opts.injection.kind}, ` +
        `key=${injectionKey(opts.injection)}`,
    )
  }

  const journal = cloneJournal(opts.pause.journal)
  journal.waitpointsResolved[matched.clientWaitpointId] = {
    kind: matched.kind,
    resolvedAt: now(),
    payload: opts.injection.payload,
    source: "live",
    matchedEventId:
      opts.injection.kind === "EVENT" ? `evt_live_${opts.injection.eventType}` : undefined,
  }

  const events: TestResult<TOut>["events"] = [
    {
      type: `waitpoint.resolved:${matched.kind}`,
      at: now(),
      data: opts.injection.payload ?? null,
    },
  ]
  const metadata: Record<string, MetadataValue> = {}
  const streams: Record<string, StreamChunk[]> = {}
  const cursors: FixtureCursors = {
    event: new Map(Object.entries(opts.pause.fixtureCursors.event)),
    signal: new Map(Object.entries(opts.pause.fixtureCursors.signal)),
  }

  const environment: EnvironmentContext = {
    name: opts.environment?.name ?? "development",
    git: opts.environment?.git,
  }

  let invocationCount = opts.pause.invocationCount
  let metadataAppliedCount = opts.pause.metadataAppliedCount
  let last: ExecuteWorkflowStepResponse | undefined

  // Remaining pending waitpoints from the previous pause (still parked).
  let carryover = opts.pause.pendingWaitpoints.filter(
    (w) => w.clientWaitpointId !== matched.clientWaitpointId,
  )

  while (invocationCount < maxInvocations) {
    invocationCount += 1

    const response = await executeWorkflowStep(workflowForExecutor(def), {
      runId: `run_test_${def.id}`,
      workflowId: def.id,
      workflowVersion: "test",
      input,
      journal,
      invocationCount,
      environment: {
        run: {
          id: `run_test_${def.id}`,
          number: 1,
          attempt: 1,
          triggeredBy: { kind: "api" },
          tags: [],
          startedAt: opts.pause.startedAt,
        },
        workflow: { id: def.id, version: "test" },
        environment,
        project: { id: "prj_test", slug: "test" },
        organization: { id: "org_test", slug: "test" },
      },
      triggeredBy: { kind: "api" },
      runStartedAt: opts.pause.startedAt,
      tags: [],
      stepRunner: createStepRunner(opts, events, now),
    })

    last = response

    const newMutations = response.metadataUpdates.slice(metadataAppliedCount)
    applyMetadata(metadata, newMutations)
    metadataAppliedCount = response.metadataUpdates.length

    for (const chunk of response.streamChunks) {
      const bucket = streams[chunk.streamId] ?? []
      streams[chunk.streamId] = bucket
      bucket.push(chunk)
    }

    if (response.status === "completed") {
      return {
        status: "completed",
        output: response.output as TOut,
        steps: stepsFromJournal(journal),
        events,
        metadata,
        compensations: [],
        streams,
        invocations: invocationCount,
      }
    }
    if (response.status === "failed") {
      return {
        status: "failed",
        error: {
          category: response.error.category,
          code: response.error.code,
          message: response.error.message,
        },
        steps: stepsFromJournal(journal),
        events,
        metadata,
        compensations: [],
        streams,
        invocations: invocationCount,
      }
    }
    if (response.status === "cancelled") {
      return {
        status: "cancelled",
        steps: stepsFromJournal(journal),
        events,
        metadata,
        compensations: response.compensations,
        streams,
        invocations: invocationCount,
      }
    }
    if (response.status === "compensated" || response.status === "compensation_failed") {
      return {
        status: response.status,
        error: response.error
          ? {
              category: response.error.category,
              code: response.error.code,
              message: response.error.message,
            }
          : undefined,
        steps: stepsFromJournal(journal),
        events,
        metadata,
        compensations: response.compensations,
        streams,
        invocations: invocationCount,
      }
    }

    const stillPending: WaitpointRegistration[] = [...carryover]
    for (const wp of response.waitpoints) {
      const resolved = await resolveWaitpoint(wp, opts, now, events, cursors)
      if (!resolved) {
        if (opts.pauseOnWait) {
          stillPending.push(wp)
          continue
        }
        throw new Error(
          `resume: waitpoint ${wp.clientWaitpointId} (${wp.kind}) has no fixture resolution. ` +
            `Provide one via TestOptions.waitForEvent / waitForSignal, or set pauseOnWait.`,
        )
      }
      journal.waitpointsResolved[wp.clientWaitpointId] = resolved
      events.push({
        type: `waitpoint.resolved:${wp.kind}`,
        at: resolved.resolvedAt,
        data: resolved.payload ?? null,
      })
    }
    carryover = [] // consumed into stillPending

    if (stillPending.length > 0) {
      return {
        status: "waiting",
        steps: stepsFromJournal(journal),
        events,
        metadata,
        compensations: [],
        streams,
        invocations: invocationCount,
        pause: {
          journal,
          pendingWaitpoints: stillPending,
          startedAt: opts.pause.startedAt,
          invocationCount,
          metadataAppliedCount,
          fixtureCursors: {
            event: Object.fromEntries(cursors.event.entries()),
            signal: Object.fromEntries(cursors.signal.entries()),
          },
        },
      }
    }
  }

  throw new Error(
    `resume: exceeded maxInvocations (${maxInvocations}). Last status: ${last?.status ?? "<none>"}.`,
  )
}

function matchWaitpoint(
  pending: readonly WaitpointRegistration[],
  inj: WaitpointInjection,
): WaitpointRegistration | undefined {
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

function cloneJournal(j: JournalSlice): JournalSlice {
  return {
    stepResults: { ...j.stepResults },
    waitpointsResolved: { ...j.waitpointsResolved },
    compensationsRun: { ...j.compensationsRun },
    metadataState: { ...j.metadataState },
    streamsCompleted: { ...j.streamsCompleted },
  }
}

function createStepRunner(
  opts: TestOptions<unknown>,
  events: TestResult<unknown>["events"],
  now: () => number,
) {
  return async (args: {
    stepId: string
    attempt: number
    input: unknown
    fn: (stepCtx: StepContext) => Promise<unknown>
    stepCtx: StepContext
  }): Promise<StepJournalEntry> => {
    const startedAt = now()
    const mock = opts.steps?.[args.stepId]
    try {
      const output = mock ? await mock(args.stepCtx) : await args.fn(args.stepCtx)
      const finishedAt = now()
      events.push({ type: "step.ok", at: finishedAt, data: { stepId: args.stepId, output } })
      return {
        attempt: args.attempt,
        status: "ok",
        output,
        startedAt,
        finishedAt,
      }
    } catch (err) {
      const finishedAt = now()
      const e = err as Error
      const code = (err as { code?: string }).code ?? "UNKNOWN"
      events.push({
        type: "step.err",
        at: finishedAt,
        data: { stepId: args.stepId, message: e.message, code },
      })
      const retryAfter = (err as { retryAfter?: unknown }).retryAfter
      return {
        attempt: args.attempt,
        status: "err",
        error: {
          category: "USER_ERROR",
          code,
          message: e.message,
          name: e.name,
          stack: e.stack,
          data: retryAfter !== undefined ? { retryAfter } : undefined,
        },
        startedAt,
        finishedAt,
      }
    }
  }
}

async function resolveWaitpoint(
  wp: WaitpointRegistration,
  opts: TestOptions<unknown>,
  now: () => number,
  parentEvents: TestResult<unknown>["events"],
  cursors: FixtureCursors,
): Promise<WaitpointResolutionEntry | null> {
  const at = now()
  if (wp.kind === "DATETIME") {
    return { kind: "DATETIME", resolvedAt: at, source: "replay" }
  }
  if (wp.kind === "EVENT") {
    const eventType = wp.meta.eventType as string
    const isIter = wp.meta.iter === true
    const fixture = opts.waitForEvent?.[eventType]
    if (fixture === undefined) return null
    if (isIter) {
      return resolveIterableFixture(
        fixture,
        cursors.event,
        eventType,
        at,
        "EVENT",
        `evt_test_${eventType}`,
      )
    }
    const payload = Array.isArray(fixture) ? fixture[0] : fixture
    return {
      kind: "EVENT",
      resolvedAt: at,
      matchedEventId: `evt_test_${eventType}`,
      payload,
      source: "live",
    }
  }
  if (wp.kind === "SIGNAL") {
    const name = wp.meta.signalName as string
    const isIter = wp.meta.iter === true
    const fixture = opts.waitForSignal?.[name]
    if (fixture === undefined) return null
    if (isIter) {
      return resolveIterableFixture(fixture, cursors.signal, name, at, "SIGNAL")
    }
    return { kind: "SIGNAL", resolvedAt: at, payload: fixture, source: "live" }
  }
  if (wp.kind === "MANUAL") {
    const tokenId = wp.meta.tokenId as string
    const fixture = opts.waitForToken?.[tokenId]
    if (fixture === undefined) return null
    return { kind: "MANUAL", resolvedAt: at, payload: fixture, source: "live" }
  }
  if (wp.kind === "RUN") {
    const childWorkflowId = wp.meta.childWorkflowId as string
    const childInput = wp.meta.childInput
    const detach = wp.meta.detach === true
    // Allow test-level override: `invoke: { [childId]: value | (input) => value }`.
    const override = opts.invoke?.[childWorkflowId]
    if (override !== undefined) {
      const payload =
        typeof override === "function"
          ? await (override as (input: unknown) => unknown | Promise<unknown>)(childInput)
          : override
      parentEvents.push({
        type: "child.resolved-from-fixture",
        at: now(),
        data: { childWorkflowId, payload, detach },
      })
      return {
        kind: "RUN",
        resolvedAt: now(),
        payload: detach ? undefined : payload,
        source: "replay",
      }
    }

    // Otherwise run the child workflow in-process.
    const child = getWorkflow(childWorkflowId)
    if (!child) {
      throw new Error(
        `test harness: ctx.invoke target "${childWorkflowId}" is not registered. ` +
          `Import the child workflow module, or provide a stub via TestOptions.invoke.`,
      )
    }
    parentEvents.push({
      type: "child.started",
      at: now(),
      data: { childWorkflowId, input: childInput },
    })
    const childResult = await runWorkflowForTest(child, childInput, {
      steps: opts.steps,
      waitForEvent: opts.waitForEvent,
      waitForSignal: opts.waitForSignal,
      waitForToken: opts.waitForToken,
      invoke: opts.invoke,
      env: opts.env,
      environment: opts.environment,
      now: opts.now,
      random: opts.random,
      maxInvocations: opts.maxInvocations,
      pauseOnWait: detach || opts.pauseOnWait,
    })
    parentEvents.push({
      type: "child.finished",
      at: now(),
      data: { childWorkflowId, status: childResult.status, output: childResult.output, detach },
    })
    if (detach) {
      return { kind: "RUN", resolvedAt: now(), payload: undefined, source: "replay" }
    }
    if (childResult.status === "completed") {
      return { kind: "RUN", resolvedAt: now(), payload: childResult.output, source: "replay" }
    }
    // Child failed / cancelled / compensated with error / compensation_failed.
    const err = childResult.error ?? {
      category: "USER_ERROR" as const,
      code: "CHILD_RUN_ENDED",
      message: `child run ended with status ${childResult.status}`,
    }
    return {
      kind: "RUN",
      resolvedAt: now(),
      source: "replay",
      error: err,
    }
  }
  return null
}

export interface FixtureCursors {
  event: Map<string, number>
  signal: Map<string, number>
}

const STREAM_END_MARKER = { __voyantStreamEnd: true } as const

function resolveIterableFixture(
  fixture: unknown,
  cursors: Map<string, number>,
  key: string,
  at: number,
  kind: "EVENT" | "SIGNAL",
  matchedEventId?: string,
): WaitpointResolutionEntry {
  const array = Array.isArray(fixture) ? fixture : [fixture]
  const idx = cursors.get(key) ?? 0
  cursors.set(key, idx + 1)
  if (idx >= array.length) {
    // Stream is exhausted — signal the tenant-side iterator to terminate.
    return {
      kind,
      resolvedAt: at,
      payload: STREAM_END_MARKER,
      source: "replay",
      matchedEventId,
    }
  }
  return {
    kind,
    resolvedAt: at,
    payload: array[idx],
    source: "live",
    matchedEventId,
  }
}

function applyMetadata(state: Record<string, MetadataValue>, updates: MetadataMutation[]): void {
  for (const u of updates) {
    switch (u.op) {
      case "set":
        state[u.key] = u.value as MetadataValue
        break
      case "increment": {
        const cur = typeof state[u.key] === "number" ? (state[u.key] as number) : 0
        state[u.key] = cur + ((u.value as number) ?? 1)
        break
      }
      case "append": {
        const cur = Array.isArray(state[u.key]) ? (state[u.key] as MetadataValue[]) : []
        state[u.key] = [...cur, u.value as MetadataValue]
        break
      }
      case "remove":
        delete state[u.key]
        break
    }
  }
}

function stepsFromJournal(j: JournalSlice): TestResult<unknown>["steps"] {
  return Object.entries(j.stepResults).map(([id, entry]) => ({
    id,
    status: entry.status,
    duration: entry.finishedAt - entry.startedAt,
    output: entry.output,
  }))
}

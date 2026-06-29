// Builds the `ctx` object passed to the workflow body.
// agent-quality: file-size exception -- Central ctx API wiring remains together until wait/stream/group runtime slices can be extracted safely.
//
// The executor owns the waitpoint-pending queue and the callbacks
// into the orchestrator; ctx is a thin shell that delegates.

import type { ServiceResolver } from "../driver.js"
import type { SerializedError } from "../protocol/index.js"
import type { Duration, RetryPolicy, WaitpointKind } from "../types.js"
import type {
  EnvironmentContext,
  GroupApi,
  GroupScope,
  InvokeApi,
  InvokeOptions,
  MetadataApi,
  ParallelApi,
  RunContext,
  StepApi,
  StepContext,
  StepFn,
  StepOptions,
  StreamApi,
  TokenWait,
  Waitable,
  WaitForEventApi,
  WaitForSignalApi,
  WaitForTokenApi,
  WorkflowContext,
  WorkflowHandle,
} from "../workflow.js"
import { advanceClockTo, type ClockState, createRandomUUID, now } from "./determinism.js"
import {
  CompensateRequestedSignal,
  isCompensateRequested,
  isRunCancelled,
  isWaitpointPending,
  RunCancelledSignal,
  WaitpointPendingSignal,
} from "./errors.js"
import type { JournalSlice, StepJournalEntry, WaitpointResolutionEntry } from "./journal.js"

/**
 * Callbacks the executor provides for operations that must reach the
 * orchestrator (over HTTP in production, in-memory in tests).
 */
export interface RuntimeCallbacks {
  /** Run a new step and journal the result. Called only for steps not already in the journal. */
  runStep(args: {
    stepId: string
    attempt: number
    input: unknown
    options: StepOptions<unknown>
    fn: StepFn<unknown>
    stepCtx: StepContext
  }): Promise<StepJournalEntry>

  /**
   * Called when a step completes successfully and had a `compensate`
   * function declared. The executor collects these in completion order
   * and runs them in reverse if the body throws or `ctx.compensate()`
   * is invoked.
   */
  recordCompensable(args: {
    stepId: string
    output: unknown
    compensate: (output: unknown) => Promise<void>
  }): void

  /** Current length of the compensable list. Used by `ctx.group` checkpoints. */
  compensableLength(): number

  /**
   * Remove and return compensables added since `fromIndex`. Used by
   * `ctx.group` to run scoped rollback without touching outer
   * compensables.
   */
  spliceCompensable(fromIndex: number): Array<{
    stepId: string
    output: unknown
    compensate: (output: unknown) => Promise<void>
  }>

  /**
   * Called by `ctx.stream()` for each chunk produced by the source.
   * In production this emits a `stream.chunk` WebSocket event and
   * journals the chunk; in tests the harness collects chunks.
   */
  pushStreamChunk(args: {
    streamId: string
    seq: number
    encoding: "text" | "json" | "base64"
    chunk: unknown
    final: boolean
  }): void

  /** Register a new waitpoint; execution will yield after this returns. */
  registerWaitpoint(args: {
    clientWaitpointId: string
    kind: WaitpointKind
    meta: Record<string, unknown>
    timeoutMs?: number
  }): void

  /** Push a metadata mutation; flushed on waitpoint yield and run completion. */
  pushMetadata(op: {
    op: "set" | "increment" | "append" | "remove"
    key: string
    value?: unknown
    target?: "self" | "parent" | "root"
  }): void

  /** Increment invocation counter when the body resumes after eviction. */
  readonly invocationCount: number

  /** Cancellation signal exposed as `ctx.signal`. */
  readonly abortSignal: AbortSignal
}

export interface RuntimeEnvironment {
  readonly run: RunContext
  readonly workflow: { id: string; version: string }
  readonly environment: EnvironmentContext
  readonly project: { id: string; slug: string }
  readonly organization: { id: string; slug: string }
}

export interface CtxBuildArgs {
  env: RuntimeEnvironment
  journal: JournalSlice
  callbacks: RuntimeCallbacks
  clock: ClockState
  random: () => number
  /** Mutated as ctx.setRetry is called; each step option inherits. */
  retryOverride: { current: RetryPolicy | undefined }
  /**
   * Read-only service resolver exposed as `ctx.services`. When unset,
   * `ctx.services.resolve(...)` throws with a clear message — workflows
   * that don't need shared services keep working without configuration.
   * Wired by the framework through `StepHandlerDeps.services` →
   * `ExecuteWorkflowStepRequest.services` → here.
   */
  services?: ServiceResolver
}

/**
 * Default resolver used when no container is plumbed through. Throws on
 * `resolve(...)` so failures are visible at the call site instead of
 * returning undefined; `has(...)` returns `false` so optional-dep
 * patterns work cleanly.
 */
const NO_OP_SERVICE_RESOLVER: ServiceResolver = {
  resolve<T>(name: string): T {
    throw new Error(
      `ctx.services.resolve("${name}"): no service container is wired into this workflow runtime. ` +
        `Pass { services } to the driver factory (e.g. via createApp({ workflows: { driver } }))`,
    )
  },
  has() {
    return false
  },
}

export function buildCtx(args: CtxBuildArgs): WorkflowContext<unknown> {
  const { env, journal, callbacks, clock, random, retryOverride } = args
  const services = args.services ?? NO_OP_SERVICE_RESOLVER

  // Per-ctx client-id counter. Reset on each ctx (= each invocation),
  // which means ids are stable relative to body execution order.
  let clientIdSeq = 0
  const nextClientId = (): number => ++clientIdSeq

  function checkCancel(): void {
    if (callbacks.abortSignal.aborted) {
      throw new RunCancelledSignal()
    }
  }

  // ---- step ----

  const step: StepApi = (async (
    id: string,
    optsOrFn: StepOptions<unknown> | StepFn<unknown>,
    maybeFn?: StepFn<unknown>,
  ) => {
    checkCancel()
    const opts: StepOptions<unknown> = typeof optsOrFn === "function" ? {} : optsOrFn
    const fn: StepFn<unknown> =
      typeof optsOrFn === "function" ? optsOrFn : (maybeFn as StepFn<unknown>)

    // Journal hit? Return cached.
    const cached = journal.stepResults[id]
    if (cached) {
      advanceClockTo(clock, cached.finishedAt)
      if (cached.status === "ok") {
        // Re-register compensable on replay so compensations are available
        // if this invocation ends up rolling back.
        if (opts.compensate) {
          callbacks.recordCompensable({
            stepId: id,
            output: cached.output,
            compensate: opts.compensate as (output: unknown) => Promise<void>,
          })
        }
        return cached.output
      }
      // Journaled error rethrows on replay so catch blocks behave consistently.
      const e = new Error(cached.error?.message ?? "step failed")
      ;(e as { code?: string }).code = cached.error?.code
      throw e
    }

    // Execute a new step via the callback, with the retry loop.
    const mergedOpts: StepOptions<unknown> = {
      ...opts,
      retry: opts.retry ?? retryOverride.current,
    }
    const policy = normalizeRetry(mergedOpts.retry)
    let attempt = 0
    let lastEntry: StepJournalEntry | undefined

    // Per-step timeout: compose the run-level abort signal with a
    // per-call AbortSignal.timeout so cooperative step bodies (fetch,
    // setTimeout wrappers, custom AbortSignal observers) stop early
    // on timeout. Hard enforcement for uncooperative bodies is done
    // below by racing the wrapped fn against a timeout rejection.
    const timeoutMs = mergedOpts.timeout !== undefined ? toMs(mergedOpts.timeout) : undefined
    const fnWithTimeout: StepFn<unknown> =
      timeoutMs !== undefined
        ? async (stepCtx) => {
            let timer: ReturnType<typeof setTimeout> | undefined
            try {
              return await Promise.race([
                fn(stepCtx),
                new Promise<never>((_, reject) => {
                  timer = setTimeout(() => {
                    const e = new Error(`step "${id}" timed out after ${timeoutMs}ms`)
                    ;(e as Error & { code?: string }).code = "TIMEOUT"
                    reject(e)
                  }, timeoutMs)
                }),
              ])
            } finally {
              if (timer !== undefined) clearTimeout(timer)
            }
          }
        : fn

    while (attempt < policy.max) {
      attempt += 1
      const stepCtx: StepContext = {
        signal:
          timeoutMs !== undefined
            ? AbortSignal.any([callbacks.abortSignal, AbortSignal.timeout(timeoutMs)])
            : callbacks.abortSignal,
        attempt,
        log: (level, msg, data) => {
          console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
            `[${id}]`,
            msg,
            data ?? "",
          )
        },
      }
      const entry = await callbacks.runStep({
        stepId: id,
        attempt,
        input: undefined,
        options: mergedOpts,
        fn: fnWithTimeout,
        stepCtx,
      })
      lastEntry = entry

      if (entry.status === "ok") {
        journal.stepResults[id] = entry
        advanceClockTo(clock, entry.finishedAt)
        if (opts.compensate) {
          callbacks.recordCompensable({
            stepId: id,
            output: entry.output,
            compensate: opts.compensate as (output: unknown) => Promise<void>,
          })
        }
        return entry.output
      }

      // Failed attempt. Check if we should stop retrying.
      if (entry.error?.code === "FATAL") break
      if (attempt >= policy.max) break

      // In production the step handler returns { retryAfter } to the DO
      // which sets an alarm; here the spike/test harness continues
      // immediately. retryAfter from RetryableError wins over the policy
      // backoff when set.
      const retryAfter = readRetryAfter(entry.error)
      await maybeDelay(retryAfter ?? backoffDelay(policy, attempt))
    }

    // Retries exhausted (or never retried).
    const finalEntry = lastEntry!
    journal.stepResults[id] = finalEntry
    advanceClockTo(clock, finalEntry.finishedAt)
    const e = new Error(finalEntry.error?.message ?? "step failed")
    ;(e as { code?: string }).code = finalEntry.error?.code
    throw e
  }) as StepApi

  // ---- waits ----

  function yieldWaitpoint(
    clientWaitpointId: string,
    kind: WaitpointKind,
    meta: Record<string, unknown>,
    timeoutMs?: number,
  ): never {
    callbacks.registerWaitpoint({ clientWaitpointId, kind, meta, timeoutMs })
    throw new WaitpointPendingSignal(clientWaitpointId)
  }

  function lookupWaitpoint(id: string): WaitpointResolutionEntry | undefined {
    return journal.waitpointsResolved[id]
  }

  const sleep = async (duration: Duration): Promise<void> => {
    checkCancel()
    const id = `sleep:${nextClientId()}`
    const resolved = lookupWaitpoint(id)
    if (resolved) {
      advanceClockTo(clock, resolved.resolvedAt)
      return
    }
    const ms = toMs(duration)
    yieldWaitpoint(id, "DATETIME", { durationMs: ms }, ms)
  }

  function makeWaitable<T>(
    kind: WaitpointKind,
    clientWaitpointId: string,
    iterIdPrefix: string,
    meta: Record<string, unknown>,
    timeoutMs?: number,
    onTimeout: "null" | "throw" = "null",
  ): Waitable<T> {
    // --- thenable: single first-match-wins resolution ---
    const resolve = (): T | null => {
      const resolved = lookupWaitpoint(clientWaitpointId)
      if (!resolved) {
        yieldWaitpoint(clientWaitpointId, kind, meta, timeoutMs)
      }
      advanceClockTo(clock, resolved.resolvedAt)
      if (resolved.payload === undefined && onTimeout === "throw") {
        throw new Error(`waitpoint ${clientWaitpointId} timed out`)
      }
      return (resolved.payload ?? null) as T | null
    }

    // --- iterable: fresh waitpoint per .next() call ---
    function makeIterator(): AsyncIterableIterator<T> {
      let closed = false
      return {
        async next(): Promise<IteratorResult<T>> {
          if (closed) return { value: undefined, done: true }
          checkCancel()
          const iterId = `${iterIdPrefix}:iter:${nextClientId()}`
          const resolvedIter = lookupWaitpoint(iterId)
          if (!resolvedIter) {
            yieldWaitpoint(iterId, kind, { ...meta, iter: true }, timeoutMs)
          }
          advanceClockTo(clock, resolvedIter.resolvedAt)
          // End-of-stream marker. Harness / orchestrator writes this to
          // tell the iterator the source has no more events.
          const payload = resolvedIter.payload as unknown
          if (isStreamEnd(payload)) {
            closed = true
            return { value: undefined, done: true }
          }
          if (payload === undefined && onTimeout === "throw") {
            throw new Error(`waitpoint ${iterId} timed out`)
          }
          return { value: payload as T, done: false }
        },
        async return(): Promise<IteratorResult<T>> {
          closed = true
          return { value: undefined, done: true }
        },
        [Symbol.asyncIterator]() {
          return this
        },
      }
    }

    const thenable: Waitable<T> = {
      // biome-ignore lint/suspicious/noThenProperty: Waitable intentionally implements PromiseLike for `await`.
      then(onFulfilled, onRejected) {
        try {
          const r = resolve()
          return Promise.resolve(r).then(onFulfilled, onRejected)
        } catch (e) {
          return Promise.reject(e).then(onFulfilled, onRejected)
        }
      },
      [Symbol.asyncIterator]() {
        return makeIterator()
      },
      close() {
        // no-op; `return()` on the iterator handles early break.
      },
    }
    return thenable
  }

  function isStreamEnd(payload: unknown): boolean {
    return (
      typeof payload === "object" &&
      payload !== null &&
      (payload as { __voyantStreamEnd?: boolean }).__voyantStreamEnd === true
    )
  }

  const waitForEvent: WaitForEventApi = ((
    eventType: string,
    opts?: { timeout?: Duration; onTimeout?: "null" | "throw" },
  ) => {
    checkCancel()
    const thenableId = `event:${eventType}:${nextClientId()}`
    const iterPrefix = `event:${eventType}`
    return makeWaitable(
      "EVENT",
      thenableId,
      iterPrefix,
      { eventType },
      opts?.timeout ? toMs(opts.timeout) : undefined,
      opts?.onTimeout,
    )
  }) as WaitForEventApi

  const waitForSignal: WaitForSignalApi = ((
    name: string,
    opts?: { timeout?: Duration; onTimeout?: "null" | "throw" },
  ) => {
    checkCancel()
    const thenableId = `signal:${name}:${nextClientId()}`
    const iterPrefix = `signal:${name}`
    return makeWaitable(
      "SIGNAL",
      thenableId,
      iterPrefix,
      { signalName: name },
      opts?.timeout ? toMs(opts.timeout) : undefined,
      opts?.onTimeout,
    )
  }) as WaitForSignalApi

  const waitForToken: WaitForTokenApi = (async (opts?: {
    tokenId?: string
    timeout?: Duration
    onTimeout?: "null" | "throw"
  }) => {
    checkCancel()
    // Allocate a stable id per call. User-supplied `tokenId` is kept
    // verbatim so external systems can reference the same value.
    const tokenId = opts?.tokenId ?? `tok_${nextClientId()}`
    const waitpointId = `token:${tokenId}`
    const timeoutMs = opts?.timeout ? toMs(opts.timeout) : undefined
    const onTimeout = opts?.onTimeout ?? "null"

    return {
      tokenId,
      url: `/__voyant/tokens/${tokenId}`,
      wait: async (): Promise<unknown> => {
        checkCancel()
        const resolved = lookupWaitpoint(waitpointId)
        if (resolved) {
          advanceClockTo(clock, resolved.resolvedAt)
          if (resolved.payload === undefined && onTimeout === "throw") {
            throw new Error(`token ${tokenId} timed out`)
          }
          return resolved.payload ?? null
        }
        yieldWaitpoint(waitpointId, "MANUAL", { tokenId }, timeoutMs)
      },
    } as TokenWait<unknown>
  }) as WaitForTokenApi

  // ---- invoke / parallel ----

  const invoke: InvokeApi = (async <TIn, TOut>(
    wf: WorkflowHandle<TIn, TOut>,
    input: TIn,
    opts?: InvokeOptions,
  ): Promise<TOut> => {
    checkCancel()
    const id = `invoke:${wf.id}:${nextClientId()}`
    const resolved = journal.waitpointsResolved[id]
    if (resolved) {
      advanceClockTo(clock, resolved.resolvedAt)
      if (resolved.error) {
        const e = new Error(resolved.error.message)
        ;(e as { code?: string }).code = resolved.error.code
        throw e
      }
      return resolved.payload as TOut
    }
    yieldWaitpoint(id, "RUN", {
      childWorkflowId: wf.id,
      childInput: input,
      detach: opts?.detach ?? false,
      tags: opts?.tags ?? [],
      lockToVersion: opts?.lockToVersion,
      idempotencyKey: opts?.idempotencyKey,
    })
  }) as InvokeApi

  const parallel: ParallelApi = async <T, R>(
    items: readonly T[],
    fn: (item: T, index: number) => Promise<R>,
    opts?: { concurrency?: number; settle?: boolean },
  ): Promise<R[]> => {
    checkCancel()
    const total = items.length
    if (total === 0) return []
    const concurrency = Math.max(1, opts?.concurrency ?? total)
    const settle = opts?.settle ?? false

    const results: R[] = new Array(total)
    const errors: { index: number; error: unknown }[] = []
    let cursor = 0
    let aborted = false

    async function worker(): Promise<void> {
      while (!aborted) {
        const i = cursor++
        if (i >= total) return
        try {
          results[i] = await fn(items[i]!, i)
        } catch (err) {
          if (settle) {
            errors.push({ index: i, error: err })
          } else {
            aborted = true
            throw err
          }
        }
      }
    }

    const workerCount = Math.min(concurrency, total)
    const workers = Array.from({ length: workerCount }, () => worker())

    if (settle) {
      await Promise.all(workers)
      if (errors.length > 0) {
        // Attach details so callers can inspect which items failed.
        const agg = new AggregateError(
          errors.map((e) => (e.error instanceof Error ? e.error : new Error(String(e.error)))),
          `ctx.parallel: ${errors.length}/${total} iteration${errors.length === 1 ? "" : "s"} failed`,
        )
        ;(agg as { failedIndices?: number[] }).failedIndices = errors.map((e) => e.index)
        throw agg
      }
      return results
    }

    await Promise.all(workers)
    return results
  }

  // ---- streams ----

  const activeStreamIds = new Set<string>()

  async function consumeStream(
    streamId: string,
    source: AsyncIterable<unknown>,
    encoding: "text" | "json" | "base64",
  ): Promise<void> {
    checkCancel()
    if (activeStreamIds.has(streamId)) {
      throw new Error(`ctx.stream: duplicate streamId "${streamId}" within the same run`)
    }
    activeStreamIds.add(streamId)
    // Replay skip: the prior invocation already drained this source
    // and the orchestrator has the chunks. Re-iterating would double
    // any side effects (LLM calls, billable APIs, file reads).
    if (journal.streamsCompleted[streamId]) {
      return
    }
    let seq = 0
    const iter = source[Symbol.asyncIterator]()
    try {
      while (true) {
        checkCancel()
        const { value, done } = await iter.next()
        if (done) {
          callbacks.pushStreamChunk({ streamId, seq: seq + 1, encoding, chunk: null, final: true })
          journal.streamsCompleted[streamId] = { chunkCount: seq + 1 }
          return
        }
        seq += 1
        const chunk = normalizeChunk(value, encoding)
        callbacks.pushStreamChunk({ streamId, seq, encoding, chunk, final: false })
      }
    } catch (err) {
      // Emit a final frame so consumers know the stream closed, then
      // propagate so the workflow body's error handling kicks in. No
      // journal entry — a failed stream should re-iterate on replay
      // (so the error surfaces deterministically).
      callbacks.pushStreamChunk({ streamId, seq: seq + 1, encoding, chunk: null, final: true })
      throw err
    }
  }

  const streamImpl = async <T>(
    streamId: string,
    sourceFn: () => AsyncGenerator<T>,
  ): Promise<void> => {
    const source = sourceFn()
    await consumeStream(streamId, source, inferEncoding(source))
  }

  const stream: StreamApi = Object.assign(streamImpl, {
    text: async (id, source) => {
      await consumeStream(id, source, "text")
    },
    json: async (id, source) => {
      await consumeStream(id, source, "json")
    },
    bytes: async (id, source) => {
      await consumeStream(id, source, "base64")
    },
  } satisfies Pick<StreamApi, "text" | "json" | "bytes">)

  // ---- groups ----

  // `ctx.group(name, fn)` creates a compensation scope. Implementation
  // strategy: the outer compensable list is the single source of truth;
  // each group tracks a checkpoint index. If the scope's body throws or
  // explicitly calls `scope.compensate()`, we splice off compensables
  // added since the checkpoint and run them LIFO, leaving outer
  // compensables untouched.
  //
  // If the scope body completes normally, compensables stay in the
  // outer list — they'll still be rolled back if the enclosing workflow
  // later throws.
  const runScopedCompensations = async (fromIndex: number): Promise<void> => {
    const scopeEntries = callbacks.spliceCompensable(fromIndex)
    for (let i = scopeEntries.length - 1; i >= 0; i--) {
      const c = scopeEntries[i]!
      try {
        await c.compensate(c.output)
      } catch {
        // One bad compensation in a scope does not abort the others.
        // Errors here don't surface to the executor — the outer rollback
        // machinery only sees the user error that triggered the scope
        // unwind.
      }
    }
  }

  const group: GroupApi = async <T>(
    _name: string,
    fn: (scope: GroupScope) => Promise<T>,
  ): Promise<T> => {
    checkCancel()
    const checkpointStart = callbacks.compensableLength()
    try {
      return await fn({
        step,
        compensate: async (): Promise<never> => {
          await runScopedCompensations(checkpointStart)
          throw new CompensateRequestedSignal()
        },
      })
    } catch (err) {
      // Only run scoped compensations for real user errors — internal
      // signals (waitpoint yield, cancellation, compensate-requested)
      // are re-thrown unchanged so the executor can route them.
      if (!isWaitpointPending(err) && !isRunCancelled(err) && !isCompensateRequested(err)) {
        await runScopedCompensations(checkpointStart)
      }
      throw err
    }
  }

  // ---- metadata ----

  const metadata: MetadataApi = {
    set(key, value) {
      callbacks.pushMetadata({ op: "set", key, value })
    },
    increment(key, by = 1) {
      callbacks.pushMetadata({ op: "increment", key, value: by })
    },
    append(key, value) {
      callbacks.pushMetadata({ op: "append", key, value })
    },
    remove(key) {
      callbacks.pushMetadata({ op: "remove", key })
    },
    // Mutations are pushed immediately via `callbacks.pushMetadata`
    // and collected on the response envelope; no explicit flush is
    // needed.
    flush: async () => {},
  }

  // ---- retry override ----

  function setRetry(policy: RetryPolicy): void {
    retryOverride.current = policy
  }

  return {
    run: env.run,
    workflow: env.workflow,
    environment: env.environment,
    project: env.project,
    organization: env.organization,
    invocationCount: callbacks.invocationCount,
    signal: callbacks.abortSignal,
    services,
    step,
    sleep,
    waitForEvent,
    waitForSignal,
    waitForToken,
    invoke,
    parallel,
    stream,
    group,
    metadata,
    now: () => now(clock),
    random,
    randomUUID: createRandomUUID(random),
    setRetry,
    compensate: async (): Promise<never> => {
      checkCancel()
      throw new CompensateRequestedSignal()
    },
  } satisfies WorkflowContext<unknown>
}

// ---- helpers ----

function inferEncoding(source: unknown): "text" | "json" | "base64" {
  // Default to json for the generic ctx.stream(id, generator) call. The
  // typed variants (text/json/bytes) override this.
  void source
  return "json"
}

function normalizeChunk(value: unknown, encoding: "text" | "json" | "base64"): unknown {
  if (encoding === "text") {
    return typeof value === "string" ? value : String(value)
  }
  if (encoding === "base64") {
    if (value instanceof Uint8Array) {
      return toBase64(value)
    }
    throw new Error("ctx.stream.bytes: expected Uint8Array chunks")
  }
  return value // json — pass through
}

function toBase64(bytes: Uint8Array): string {
  // Node + modern runtimes provide Buffer or btoa. Use Buffer when
  // available for efficiency; fall back to manual encode for isolates.
  const g = globalThis as typeof globalThis & {
    Buffer?: { from(b: Uint8Array): { toString(enc: "base64"): string } }
    btoa?: (s: string) => string
  }
  if (g.Buffer) return g.Buffer.from(bytes).toString("base64")
  if (g.btoa) {
    let s = ""
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
    return g.btoa(s)
  }
  // Manual fallback (rare).
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  let out = ""
  let i = 0
  while (i < bytes.length) {
    const b1 = bytes[i++]!
    const b2 = i < bytes.length ? bytes[i++]! : 0
    const b3 = i < bytes.length ? bytes[i++]! : 0
    out += chars[b1 >> 2]!
    out += chars[((b1 & 3) << 4) | (b2 >> 4)]!
    out += i - 1 > bytes.length ? "=" : chars[((b2 & 15) << 2) | (b3 >> 6)]!
    out += i > bytes.length ? "=" : chars[b3 & 63]!
  }
  return out
}

interface ResolvedRetryPolicy {
  max: number
  backoff: "exponential" | "linear" | "fixed"
  initial: number // ms
  maxDelay: number // ms
}

function normalizeRetry(input: RetryPolicy | { max: 0 } | undefined): ResolvedRetryPolicy {
  if (!input) return { max: 1, backoff: "exponential", initial: 1000, maxDelay: 60_000 }
  const max = input.max ?? 3
  const policy = input as RetryPolicy
  return {
    max: Math.max(1, max),
    backoff: policy.backoff ?? "exponential",
    initial: policy.initial !== undefined ? toMs(policy.initial) : 1000,
    maxDelay: policy.maxDelay !== undefined ? toMs(policy.maxDelay) : 60_000,
  }
}

function backoffDelay(policy: ResolvedRetryPolicy, attempt: number): number {
  // `attempt` is 1-indexed; delay applies *before* the next attempt.
  if (policy.backoff === "fixed") return Math.min(policy.initial, policy.maxDelay)
  if (policy.backoff === "linear") return Math.min(policy.initial * attempt, policy.maxDelay)
  // exponential
  return Math.min(policy.initial * 2 ** (attempt - 1), policy.maxDelay)
}

function readRetryAfter(err: SerializedError | undefined): number | undefined {
  if (!err) return undefined
  if (err.code !== "RETRYABLE") return undefined
  const raw = (err.data as { retryAfter?: unknown } | undefined)?.retryAfter
  if (raw === undefined) return undefined
  if (typeof raw === "number") return raw
  if (raw instanceof Date) return raw.getTime() - Date.now()
  if (typeof raw === "string") {
    try {
      return toMs(raw as Duration)
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * In the real runtime, retry delay is expressed to the orchestrator as a
 * `retryAfter` field on the step callback response, and the DO sets an
 * alarm — no worker sits idle. In tests we skip the delay (pass it
 * through `setTimeout(0)` at most) so the suite stays fast.
 */
async function maybeDelay(ms: number): Promise<void> {
  if (ms <= 0) return
  // Cap at 10ms in-process regardless of declared delay. Test harness
  // doesn't model real time; production replaces this with a DO alarm.
  await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 10)))
}

function toMs(d: Duration): number {
  if (typeof d === "number") return d
  const m = /^(\d+)(ms|s|m|h|d|w)$/.exec(d)
  if (!m) throw new Error(`invalid duration: ${String(d)}`)
  const n = Number(m[1])
  switch (m[2]) {
    case "ms":
      return n
    case "s":
      return n * 1000
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

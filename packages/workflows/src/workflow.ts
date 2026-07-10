// Workflow declaration and the `ctx` object.
// Authoritative contract in docs/sdk-surface.md §2–§3.

import type { Condition } from "./conditions.js"
import type { ServiceResolver } from "./driver.js"
import type {
  Duration,
  EnvironmentName,
  MachineType,
  RateLimitSpec,
  RetryPolicy,
  RunStatus,
  RunTrigger,
} from "./types.js"

// ---- Workflow ----

export interface WorkflowHandle<TInput = unknown, TOutput = unknown> {
  readonly id: string
  /** Phantom; used only for TypeScript inference of `workflows.trigger(...)`. */
  readonly __input?: TInput
  readonly __output?: TOutput
}

export interface WorkflowConfig<TInput, TOutput> {
  id: string
  input?: unknown
  output?: unknown
  description?: string
  schedule?: ScheduleDeclaration | ScheduleDeclaration[]
  concurrency?: ConcurrencyPolicy<TInput>
  retry?: RetryPolicy
  timeout?: Duration
  /**
   * Workflows execute on the Node runtime. Kept as an optional field so
   * existing manifests/configs can annotate the runtime explicitly.
   */
  defaultRuntime?: "node"
  tags?: string[]
  run: (input: TInput, ctx: WorkflowContext<TInput>) => Promise<TOutput>
}

/**
 * Internal registered form of a workflow. The executor takes this
 * plus a request and drives the body.
 */
export interface WorkflowDefinition<TInput = unknown, TOutput = unknown>
  extends WorkflowHandle<TInput, TOutput> {
  readonly config: WorkflowConfig<TInput, TOutput>
}

export type ScheduleDeclaration = (
  | { cron: string }
  | { every: Duration }
  | { at: string | Date }
) & {
  timezone?: string
  input?: unknown | (() => unknown | Promise<unknown>)
  enabled?: boolean
  overlap?: "skip" | "queue" | "allow"
  environments?: EnvironmentName[]
  name?: string
}

export interface ConcurrencyPolicy<TInput> {
  key?: string | ((input: TInput) => string)
  limit?: number
  strategy?: "queue" | "cancel-in-progress" | "cancel-newest" | "round-robin"
}

/**
 * Process-local registry. Backed by globalThis so bundles that inline
 * their own copy of @voyant-travel/workflows still share the registry with
 * the loader's copy (voyant build relies on this to extract the
 * manifest from a user bundle at load-time). Module-local `const`
 * would create a private map per bundle copy.
 */
const REGISTRY_KEY = "__voyantWorkflowRegistry" as const
const globalRef = globalThis as typeof globalThis &
  Record<typeof REGISTRY_KEY, Map<string, WorkflowDefinition> | undefined>
const REGISTRY: Map<string, WorkflowDefinition> =
  globalRef[REGISTRY_KEY] ?? new Map<string, WorkflowDefinition>()
globalRef[REGISTRY_KEY] = REGISTRY

/**
 * Define a workflow without registering it in the process-local registry.
 * Use this for definitions that are collected explicitly by a project or plugin.
 */
export function defineWorkflow<TInput = unknown, TOutput = unknown>(
  config: WorkflowConfig<TInput, TOutput>,
): WorkflowDefinition<TInput, TOutput> {
  return {
    id: config.id,
    config,
  }
}

/** Declare and register a workflow. See docs/sdk-surface.md §2.1. */
export function workflow<TInput = unknown, TOutput = unknown>(
  config: WorkflowConfig<TInput, TOutput>,
): WorkflowDefinition<TInput, TOutput> {
  // Vite / Cloudflare workerd HMR re-evaluates modules in place, so a
  // workflow file that registers ids at import-time will be re-imported
  // on every save. Throwing on duplicate ids would surface real
  // collisions but also kills the entire dev loop. The CLI's pre-flight
  // (`voyant workflows build`) is the right place to catch genuine
  // duplicates across files; here we replace + warn so HMR keeps
  // working. Production bundles run this once at startup, so the
  // duplicate path is effectively dev-only.
  if (REGISTRY.has(config.id)) {
    console.warn(
      `[workflows] workflow id "${config.id}" re-registered — assuming HMR re-import. ` +
        `If this is a real duplicate, \`voyant workflows build\` will reject the bundle.`,
    )
  }
  const def = defineWorkflow(config)
  REGISTRY.set(config.id, def as WorkflowDefinition)
  return def
}

/** Internal: look up a registered workflow by id. */
export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return REGISTRY.get(id)
}

/**
 * Internal: enumerate every registered workflow. Used by the CLI to list
 * workflows discovered from a loaded entry file. Not part of the stable
 * public API — implementation detail of the SDK/CLI pair.
 */
export function __listRegisteredWorkflows(): WorkflowDefinition[] {
  return [...REGISTRY.values()]
}

/**
 * Internal: clear the workflow registry. Called by the CLI between
 * builds / hot-reloads to drop stale workflows before re-importing
 * the tenant bundle, and by test suites in beforeEach to isolate
 * runs. Not part of the stable public API.
 */
export function __resetRegistry(): void {
  REGISTRY.clear()
}

// ---- Context ----

export interface RunContext {
  id: string
  number: number
  attempt: number
  triggeredBy: RunTrigger
  tags: readonly string[]
  startedAt: number
}

export interface EnvironmentContext {
  name: EnvironmentName
  git?: {
    commit: string
    branch: string
    pr?: { number: number; url: string }
  }
}

export interface WorkflowContext<_TInput = unknown> {
  readonly run: RunContext
  readonly workflow: { id: string; version: string }
  readonly environment: EnvironmentContext
  readonly project: { id: string; slug: string }
  readonly organization: { id: string; slug: string }
  readonly invocationCount: number
  readonly signal: AbortSignal

  /**
   * Read-only view of the framework's service container. Step bodies resolve
   * shared services (db, indexer, etc.) via `ctx.services.resolve("name")`.
   * The framework wires this from `createApp()`'s `ModuleContainer` through
   * `StepHandlerDeps.services`. When no container is plumbed (driver not
   * configured with `services`, or in raw orchestrator tests), `resolve(...)`
   * throws with a clear message and `has(...)` returns `false`.
   */
  readonly services: ServiceResolver

  step: StepApi
  sleep: (duration: Duration) => Promise<void>
  waitForEvent: WaitForEventApi
  waitForSignal: WaitForSignalApi
  waitForToken: WaitForTokenApi
  invoke: InvokeApi
  parallel: ParallelApi
  stream: StreamApi
  group: GroupApi
  compensate: () => Promise<never>
  metadata: MetadataApi

  now: () => number
  random: () => number
  randomUUID: () => string

  setRetry: (policy: RetryPolicy) => void
}

// ---- Step ----

export interface StepApi {
  <T>(id: string, fn: StepFn<T>): Promise<T>
  <T>(id: string, opts: StepOptions<T>, fn: StepFn<T>): Promise<T>
}

export type StepFn<T> = (stepCtx: StepContext) => Promise<T>

export interface StepContext {
  signal: AbortSignal
  attempt: number
  log: (level: "info" | "warn" | "error", msg: string, data?: object) => void
}

export interface StepOptions<T = unknown> {
  /**
   * Steps execute on the Node runtime. Kept as an optional no-op annotation
   * for callers that already specify `runtime: "node"`.
   */
  runtime?: "node"
  machine?: MachineType
  timeout?: Duration
  retry?: RetryPolicy | { max: 0 }
  idempotencyKey?: string
  compensate?: (output: T) => Promise<void>
  rateLimit?: RateLimitSpec
  waitFor?: Condition
  cancelIf?: Condition
  skipIf?: Condition
}

// ---- Waits ----

export interface Waitable<T> extends PromiseLike<T | null> {
  [Symbol.asyncIterator](): AsyncIterableIterator<T>
  close(): void
}

export type WaitForEventApi = <T = unknown>(
  eventType: string,
  opts?: WaitForEventOptions<T>,
) => Waitable<T>

export interface WaitForEventOptions<T> {
  match?: Partial<T> | ((payload: T) => boolean)
  timeout?: Duration
  lookback?: Duration
  bufferSize?: number
  onTimeout?: "null" | "throw"
}

export type WaitForSignalApi = <T = unknown>(
  name: string,
  opts?: WaitForSignalOptions<T>,
) => Waitable<T>
export interface WaitForSignalOptions<T> extends WaitForEventOptions<T> {}

export type WaitForTokenApi = <T = unknown>(opts?: WaitForTokenOptions<T>) => Promise<TokenWait<T>>
export interface WaitForTokenOptions<_T> {
  tokenId?: string
  timeout?: Duration
  onTimeout?: "null" | "throw"
  schema?: unknown
}
export interface TokenWait<T> {
  tokenId: string
  url: string
  wait: () => Promise<T | null>
}

// ---- Invoke / parallel ----

export type InvokeApi = <TIn, TOut>(
  workflow: WorkflowHandle<TIn, TOut>,
  input: TIn,
  opts?: InvokeOptions,
) => Promise<TOut>

export interface InvokeOptions {
  idempotencyKey?: string
  tags?: string[]
  lockToVersion?: string
  /**
   * Fire-and-forget child run. The child is still triggered and
   * persisted, but the parent does not wait for its output or error.
   * The awaited result resolves to `undefined`; callers should not use
   * detached invokes for control flow.
   */
  detach?: boolean
}

export type ParallelApi = <T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  opts?: ParallelOptions,
) => Promise<R[]>

export interface ParallelOptions {
  concurrency?: number
  settle?: boolean
}

// ---- Streams ----

export interface StreamApi {
  text(streamId: string, source: AsyncIterable<string>): Promise<void>
  json<T>(streamId: string, source: AsyncIterable<T>): Promise<void>
  bytes(streamId: string, source: AsyncIterable<Uint8Array>): Promise<void>
  <T>(streamId: string, fn: () => AsyncGenerator<T>): Promise<void>
}

// ---- Groups (scoped compensation) ----

export type GroupApi = <T>(name: string, fn: (scope: GroupScope) => Promise<T>) => Promise<T>
export interface GroupScope {
  step: StepApi
  compensate: () => Promise<never>
}

// ---- Metadata ----

export type MetadataValue =
  | string
  | number
  | boolean
  | null
  | MetadataValue[]
  | { [key: string]: MetadataValue }

export interface MetadataMutatorSubset {
  set(key: string, value: MetadataValue): void
  increment(key: string, by?: number): void
  append<T>(key: string, value: T): void
  remove(key: string): void
}

export interface MetadataApi extends MetadataMutatorSubset {
  flush(): Promise<void>
  parent?: MetadataMutatorSubset
  root?: MetadataMutatorSubset
}

export type { RunStatus }

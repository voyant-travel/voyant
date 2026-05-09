// Triggering workflows from server code, plus event filter declarations.
// Authoritative contract in docs/sdk-surface.md §6.

import type { Duration, EnvironmentName, RunStatus } from "./types.js"
import type { WorkflowHandle } from "./workflow.js"

// ---- workflows.* ----

export interface WorkflowsClient {
  trigger<TIn, TOut>(
    workflow: WorkflowHandle<TIn, TOut> | string,
    input: TIn,
    opts?: TriggerOptions,
  ): Promise<Run<TOut>>

  signal(runId: string, name: string, payload: unknown, opts?: { nonce?: string }): Promise<void>
  completeToken(tokenId: string, payload: unknown): Promise<void>

  cancel(runId: string, opts?: { compensate?: boolean; reason?: string }): Promise<void>
  retry(runId: string, opts: { mode: "re-trigger" | "resume" }): Promise<Run>
  replay(runId: string, opts?: { fromStepId?: string; input?: unknown }): Promise<Run>

  get(runId: string): Promise<RunDetail>
  list(opts?: ListRunsOptions): Promise<{ runs: RunSummary[]; nextCursor?: string }>

  mintAccessToken(opts: MintAccessTokenOptions): Promise<PublicAccessToken>
}

export interface TriggerOptions {
  idempotencyKey?: string
  delay?: Duration | Date
  debounce?: { key: string; delay: Duration; mode?: "leading" | "trailing" }
  ttl?: Duration
  tags?: string[]
  priority?: number
  concurrencyKey?: string
  lockToVersion?: string
  environment?: EnvironmentName
  issuePublicAccessToken?: boolean
}

export interface Run<TOut = unknown> {
  id: string
  workflowId: string
  status: RunStatus
  startedAt: number
  accessToken?: string
  /** Phantom; used only for TypeScript inference. */
  readonly __output?: TOut
}

export interface RunSummary {
  id: string
  workflowId: string
  status: RunStatus
  startedAt: number
  completedAt?: number
  tags: string[]
  environment: EnvironmentName
}

export interface RunDetail<TOut = unknown> extends RunSummary {
  version: string
  input: unknown
  output?: TOut
  error?: unknown
  durationMs?: number
  // ... full shape in docs/runtime-protocol.md §4.2
}

export interface ListRunsOptions {
  workflowId?: string
  status?: RunStatus | RunStatus[]
  environment?: EnvironmentName
  tag?: string
  since?: Date | number
  until?: Date | number
  cursor?: string
  limit?: number
}

export interface MintAccessTokenOptions {
  target:
    | { kind: "run"; runId: string }
    | { kind: "workflow"; workflowId: string }
    | { kind: "tag"; tag: string }
  scope: ("read" | "trigger" | "cancel")[]
  ttl?: Duration
}

export interface PublicAccessToken {
  token: string
  exp: number
}

/**
 * Top-level server SDK client. Resolves against the configured
 * Voyant Cloud API key and account. The runtime implementation is
 * installed by the cloud client package; imported alone, every
 * method throws with guidance.
 */
export const workflows: WorkflowsClient = new Proxy({} as WorkflowsClient, {
  get(_, method: string) {
    return () => {
      throw new Error(
        `@voyantjs/workflows: workflows.${method}() requires the Voyant Cloud client. ` +
          `Install + configure it via @voyantjs/client, or see docs/sdk-surface.md §6.`,
      )
    }
  },
})

// ---- trigger.on ----

import { compileAndRegister } from "./events/compile.js"
import type { InputMapper } from "./events/input-mapper.js"
import type { PredicateExpr } from "./events/predicate.js"

export interface EventFilterHandle {
  readonly id: string
  readonly event: string
}

/**
 * Declarative binding from an event name to a target workflow. Authors call
 * `trigger.on(eventName, declaration)` at module-load time; the framework
 * collects the entries via the process-local registry (see
 * `./events/registry.js`) and ships them in the manifest.
 *
 * `where` and `input` are structured DSLs (no callbacks) so the runtime
 * can evaluate them anywhere — in-process for self-host, server-side for
 * managed deployments. The previous `match` callback is no longer
 * supported; registration throws if it's set.
 */
export interface EventFilterDeclaration<T> {
  target: WorkflowHandle<T, unknown>
  /** Structured predicate; see `@voyantjs/workflows/events` `PredicateExpr`. */
  where?: PredicateExpr
  /** Structured input projection; see `@voyantjs/workflows/events` `InputMapper`. */
  input?: InputMapper
}

export interface TriggerApi {
  on<T = unknown>(event: string, filter: EventFilterDeclaration<T>): EventFilterHandle
}

export const trigger: TriggerApi = {
  on<T>(event: string, filter: EventFilterDeclaration<T>): EventFilterHandle {
    return compileAndRegister(event, filter)
  },
}

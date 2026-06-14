// Event filter declarations, plus compatibility re-exports for the
// client-safe workflows trigger surface.
// Authoritative contract in docs/sdk-surface.md §6.

import type { WorkflowHandle } from "./workflow.js"

// ---- workflows.* ----

export type {
  ListRunsOptions,
  MintAccessTokenOptions,
  PublicAccessToken,
  Run,
  RunDetail,
  RunSummary,
  TriggerOptions,
  WorkflowsClient,
} from "./client.js"
export { workflows } from "./client.js"

// ---- trigger.on ----

import { compileAndRegister } from "./events/compile.js"
import type { InputMapper } from "./events/input-mapper.js"
import type { PredicateExpr } from "./events/predicate.js"
import type { EventFilterRuntimeEntry } from "./events/registry.js"

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
  /** Structured predicate; see `@voyant-travel/workflows/events` `PredicateExpr`. */
  where?: PredicateExpr
  /** Structured input projection; see `@voyant-travel/workflows/events` `InputMapper`. */
  input?: InputMapper
}

export interface TriggerApi {
  /**
   * Register an event filter targeting `event`. Returns the
   * {@link EventFilterRuntimeEntry} so authors can drop it directly into
   * `Module.eventFilters` / `Plugin.eventFilters` — the entry structurally
   * satisfies core's `EventFilterDescriptor` (matching `id` + `eventType`)
   * and carries the manifest payload `createApp()` needs to register with
   * the driver.
   */
  on<T = unknown>(event: string, filter: EventFilterDeclaration<T>): EventFilterRuntimeEntry
}

export const trigger: TriggerApi = {
  on<T>(event: string, filter: EventFilterDeclaration<T>): EventFilterRuntimeEntry {
    return compileAndRegister(event, filter)
  },
}

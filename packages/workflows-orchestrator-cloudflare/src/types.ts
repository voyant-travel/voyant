// Structural types for the Cloudflare surface we use. We don't take
// a hard dependency on `@cloudflare/workers-types` — matching the
// shape is enough, and tests can pass plain objects.

import type { WaitpointInjection } from "@voyantjs/workflows-orchestrator"

/**
 * Subset of Cloudflare's `DurableObjectStorage` we actually use.
 * Keyed JSON blobs; no transactional guarantees beyond what a single
 * method call gives.
 *
 * Alarm methods are optional so in-memory fakes can opt out. On the
 * real CF runtime they are always available. The adapter uses them
 * to wake parked runs when their earliest DATETIME waitpoint comes
 * due — see `handleDurableObjectAlarm`.
 */
export interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<boolean>
  list<T>(options?: { prefix?: string; limit?: number }): Promise<Map<string, T>>
  /** ms-since-epoch of the scheduled alarm, or null if none. */
  getAlarm?(): Promise<number | null>
  /** Schedule the DO's alarm() method to fire at `wakeAt`. */
  setAlarm?(wakeAt: number): Promise<void>
  /** Cancel any pending alarm. */
  deleteAlarm?(): Promise<void>
}

/**
 * Subset of a Workers-for-Platforms dispatch namespace. `get(name)`
 * returns a binding whose `fetch` delivers to the tenant Worker
 * registered under that name.
 */
export interface DispatchNamespaceLike {
  get(
    name: string,
    args?: Record<string, unknown>,
  ): {
    fetch(request: Request): Promise<Response>
  }
}

/** Args the Worker passes when routing to a run DO. */
export interface RunOperation {
  op: "trigger" | "resume" | "cancel" | "get"
  payload?: unknown
}

/** Injection payload on resume ops. */
export interface ResumePayload {
  injection: WaitpointInjection
}

/** Trigger payload. */
export interface TriggerPayload {
  workflowId: string
  workflowVersion: string
  input: unknown
  tenantMeta: {
    tenantId: string
    projectId: string
    organizationId: string
    /**
     * Dispatch-namespace name to forward step requests to. Required only
     * for the Workers-for-Platforms dispatcher; self-host single-tenant
     * deployments using `createInlineDispatcher` /
     * `createServiceBindingDispatcher` / `createHttpDispatcher` can omit.
     */
    tenantScript?: string
  }
  environment?: "production" | "preview" | "development"
  tags?: string[]
  runId?: string
}

/** Cancel payload. */
export interface CancelPayload {
  reason?: string
}

/**
 * The Worker runtime env the adapter expects. Callers provide their
 * own wrangler config; this interface documents what we read.
 */
export interface AdapterEnv<DONamespace = unknown, DispatchNS = DispatchNamespaceLike> {
  /** Durable Object namespace holding one DO per run. Typed loosely to avoid a CF types dep. */
  WORKFLOW_RUN_DO: DONamespace
  /** Dispatch namespace containing tenant Workers. */
  DISPATCHER: DispatchNS
}

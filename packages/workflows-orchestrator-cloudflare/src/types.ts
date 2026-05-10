// Structural types for the Cloudflare surface we use. We don't take
// a hard dependency on `@cloudflare/workers-types` — matching the
// shape is enough, and tests can pass plain objects.

import type { Duration, RunTrigger } from "@voyantjs/workflows"
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
     * Adapter-specific tenant identifier. Opaque to the OSS runtime —
     * surfaces on `StepDispatcherContext` so custom dispatchers can
     * use it as a routing key.
     */
    tenantScript?: string
  }
  environment?: "production" | "preview" | "development"
  tags?: string[]
  runId?: string
  idempotencyKey?: string
  delay?: Duration | { wakeAt: number }
  priority?: number
  triggeredBy?: RunTrigger
}

/** Cancel payload. */
export interface CancelPayload {
  reason?: string
}

/**
 * The Worker runtime env the adapter expects. Callers provide their
 * own wrangler config; this interface documents what we read.
 */
export interface AdapterEnv<DONamespace = unknown> {
  /** Durable Object namespace holding one DO per run. Typed loosely to avoid a CF types dep. */
  WORKFLOW_RUN_DO: DONamespace
}

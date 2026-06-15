// Core type aliases used across the SDK.
// Authoritative definitions in docs/sdk-surface.md §0 and §2.

export type Duration = number | `${number}${"ms" | "s" | "m" | "h" | "d" | "w"}`

/** Hosted/self-hosted Node runner profile. */
export type MachineType =
  | "lite"
  | "basic"
  | "standard-1"
  | "standard-2"
  | "standard-3"
  | "standard-4"
  | (string & {})

export type EnvironmentName = "production" | "preview" | "development"

export type RunStatus =
  | "pending"
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "cancelled_by_dev_reload"
  | "cancelled_by_version_sunset"
  | "compensated"
  | "compensation_failed"
  | "timed_out"

export type ExecutionStatus =
  | "CREATED"
  | "QUEUED"
  | "EXECUTING"
  | "EXECUTING_WITH_WAITPOINTS"
  | "SUSPENDED"
  | "PENDING_CANCEL"
  | "FINISHED"

export type WaitpointKind = "DATETIME" | "EVENT" | "SIGNAL" | "RUN" | "MANUAL"

export interface RetryPolicy {
  max?: number
  backoff?: "exponential" | "linear" | "fixed"
  initial?: Duration
  maxDelay?: Duration
}

export interface RateLimitSpec {
  key: string | ((input: unknown, ctx: { run: { id: string }; project: { id: string } }) => string)
  limit: number | ((input: unknown) => number)
  units?: number | ((input: unknown) => number)
  window: Duration
  onLimit?: "queue" | "fail"
}

export type RunTrigger =
  | { kind: "api"; actor?: string; accessTokenId?: string }
  | { kind: "schedule"; scheduleId: string }
  | { kind: "event"; eventId: string; eventType: string; filterId: string }
  | { kind: "parent"; parentRunId: string; parentStepId: string }

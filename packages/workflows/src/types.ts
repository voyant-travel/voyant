// Core type aliases used across the SDK.
// Authoritative definitions in docs/sdk-surface.md §0 and §2.

export type Duration = number | `${number}${"ms" | "s" | "m" | "h" | "d" | "w"}`

/**
 * Cloudflare Container instance types — the set Voyant Cloud honors
 * for `runtime: "node"` steps. Match the sizes published at
 * https://developers.cloudflare.com/containers/ (as of
 * compat-date 2026-04-01).
 *
 * | name        | vCPU  | memory  | disk  |
 * | ----------- | ----- | ------- | ----- |
 * | lite        | 1/16  | 256 MiB | 2 GB  |
 * | basic       | 1/4   | 1 GiB   | 4 GB  |
 * | standard-1  | 1/2   | 4 GiB   | 8 GB  |
 * | standard-2  | 1     | 6 GiB   | 12 GB |
 * | standard-3  | 2     | 8 GiB   | 16 GB |
 * | standard-4  | 4     | 12 GiB  | 20 GB |
 *
 * The open `(string & {})` escape hatch accepts CF custom instance
 * types (up to 4 vCPU / 12 GiB / 20 GB, min 3 GiB RAM per vCPU) —
 * rendered as `"custom-<vcpu>-<ramGiB>"` by convention.
 */
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

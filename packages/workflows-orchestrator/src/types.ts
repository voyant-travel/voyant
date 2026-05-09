// Types the orchestrator core uses. Decoupled from any transport:
// the same RunRecord/Store shapes underpin the in-memory test store,
// the Durable-Object-backed production store, and any future adapters.

import type { RunTrigger, WaitpointKind } from "@voyantjs/workflows"
import type {
  StepHandlerError,
  WorkflowStepRequest,
  WorkflowStepResponse,
} from "@voyantjs/workflows/handler"
import type {
  CompensationJournalEntry,
  JournalSlice,
  StepJournalEntry,
  WaitpointResolutionEntry,
} from "@voyantjs/workflows/protocol"

export type {
  CompensationJournalEntry,
  JournalSlice,
  RunTrigger,
  StepJournalEntry,
  WaitpointKind,
  WaitpointResolutionEntry,
  WorkflowStepRequest,
  WorkflowStepResponse,
}

/**
 * Terminal and non-terminal run statuses. Mirrors the wire statuses
 * from docs/runtime-protocol.md §5 but only the states the orchestrator
 * itself cares about.
 */
export type OrchestratorRunStatus =
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "compensated"
  | "compensation_failed"

export interface PendingWaitpoint {
  clientWaitpointId: string
  kind: WaitpointKind
  meta: Record<string, unknown>
  timeoutMs?: number
}

export interface StreamChunk {
  streamId: string
  seq: number
  encoding: "text" | "json" | "base64"
  chunk: unknown
  final: boolean
  at: number
}

export interface RunRecord {
  id: string
  workflowId: string
  workflowVersion: string
  status: OrchestratorRunStatus
  input: unknown
  /** Output on "completed" runs. */
  output?: unknown
  /** SerializedError for failed / compensation_failed. */
  error?: { category: string; code: string; message: string }
  /** Journal accumulated across every tenant invocation. */
  journal: JournalSlice
  /** Number of tenant invocations performed so far. */
  invocationCount: number
  /**
   * Positional dedup cursor for `metadataUpdates`. Each executor
   * response re-emits every metadata mutation the body made (including
   * those from prior invocations, since the body replays from the
   * start). The orchestrator applies only the delta beyond what it's
   * seen to avoid double-counting increments / duplicate appends.
   */
  metadataAppliedCount: number
  /**
   * Cumulative ms spent inside tenant invocations, excluding parked
   * time. Used to enforce workflow-level timeouts — a run that
   * parks for a week on a waitpoint should not count that week
   * against its compute budget.
   */
  computeTimeMs: number
  /** ms budget from WorkflowConfig.timeout. Zero / undefined = no limit. */
  timeoutMs?: number
  /**
   * Trigger-time scheduling priority. Higher numbers are claimed first
   * by store-backed time wheels when multiple runs are due.
   */
  priority?: number
  /**
   * Cross-run lineage. Present on child runs created by
   * `ctx.invoke`; set by the orchestrator when the child parks so
   * its eventual terminal transition can cascade-resume the parent.
   */
  parent?: {
    runId: string
    waitpointId: string
  }
  /** Pending waitpoints, only populated when status === "waiting". */
  pendingWaitpoints: PendingWaitpoint[]
  /** Stream chunks accumulated across every tenant invocation, keyed by streamId. */
  streams: Record<string, StreamChunk[]>
  /** Wall-clock fields, all ms-since-epoch. */
  startedAt: number
  completedAt?: number
  /** Trigger metadata. */
  triggeredBy: RunTrigger
  tags: string[]
  /** Optional environment metadata. */
  environment: "production" | "preview" | "development"
  /** Tenant identity flows through every step request. */
  tenantMeta: {
    tenantId: string
    projectId: string
    organizationId: string
    projectSlug?: string
    organizationSlug?: string
    /**
     * Identifier the runtime adapter uses to locate the tenant's
     * code. On Cloudflare this is the dispatch-namespace script name;
     * on other targets it may be a container image tag or Node script
     * path. Optional so local/in-process drivers aren't forced to set it.
     */
    tenantScript?: string
  }
  runMeta: {
    number: number
    attempt: number
  }
  /**
   * Caller-supplied idempotency token, mirrored from `TriggerArgs.idempotencyKey`.
   * Persistent stores use this column to enforce dedup natively (e.g. unique
   * partial index in `voyant_snapshot_runs`); in-process stores ignore it.
   */
  idempotencyKey?: string
}

export interface RunRecordStore {
  get(id: string): Promise<RunRecord | undefined>
  save(record: RunRecord): Promise<RunRecord>
  /**
   * Atomically insert a new run record, OR return the existing one if
   * a record with the same `id` already exists. Used by `trigger()` to
   * close the get-then-save race window when an idempotency-derived
   * runId could collide across concurrent callers.
   *
   * Stores must implement this with a single atomic operation:
   *   - Postgres: `INSERT … ON CONFLICT (id) DO NOTHING RETURNING …`,
   *               with a fallback SELECT when no row is returned.
   *   - InMemory / FS: check-then-set in a single microtask.
   *   - DO storage: get-then-save is naturally atomic per DO instance.
   *
   * The returned `created: true` means this caller's record was the
   * winner — drive it. `created: false` means another caller raced in
   * first; return the existing record without re-driving (per
   * architecture doc §15.2).
   */
  tryInsert(record: RunRecord): Promise<{ record: RunRecord; created: boolean }>
  list(filter?: {
    workflowId?: string
    status?: OrchestratorRunStatus
    limit?: number
  }): Promise<RunRecord[]>
}

/**
 * The tenant-side step handler. In-process for tests / local dev via
 * `handleStepRequest` from @voyantjs/workflows/handler; HTTP in
 * production (via a fetch to the tenant Worker). The optional
 * per-invocation `signal` aborts in-flight step bodies when the run
 * is cancelled mid-execution.
 */
export type StepHandler = (
  req: WorkflowStepRequest,
  opts?: {
    signal?: AbortSignal
    /**
     * Fires synchronously from `ctx.stream.*` as each chunk is
     * produced. In-process only; HTTP transport drops it (chunks
     * still arrive in the response body). Used by orchestrators to
     * broadcast chunks to dashboards before the invocation returns.
     */
    onStreamChunk?: (chunk: StreamChunk) => void
  },
) => Promise<
  { status: number; body: WorkflowStepResponse } | { status: number; body: StepHandlerError }
>

/**
 * Injection delivered by an external signal (dashboard, API, inbox).
 * Same shape used by the dashboard inject endpoints.
 */
export type WaitpointInjection =
  | { kind: "EVENT"; eventType: string; payload?: unknown }
  | { kind: "SIGNAL"; name: string; payload?: unknown }
  | { kind: "MANUAL"; tokenId: string; payload?: unknown }

// @voyantjs/workflows/protocol
//
// Wire-protocol types shared with the orchestrator. Full contract
// in docs/runtime-protocol.md; types here are exported so callers
// (test harness, adapters, dashboards) can build and inspect wire
// payloads without reaching into runtime internals.

export type ProtocolVersion = 1
export const PROTOCOL_VERSION: ProtocolVersion = 1

// Journal types: shape of the tenant-side view of a run's state.
// Re-exported so orchestrators and tools can build/inspect journals
// without reaching into the runtime subpath.
export type {
  CompensationJournalEntry,
  JournalSlice,
  StepJournalEntry,
  WaitpointResolutionEntry,
} from "../runtime/journal.js"

export type ExecutionStatus =
  | "CREATED"
  | "QUEUED"
  | "EXECUTING"
  | "EXECUTING_WITH_WAITPOINTS"
  | "SUSPENDED"
  | "PENDING_CANCEL"
  | "FINISHED"

export type WaitpointKind = "DATETIME" | "EVENT" | "SIGNAL" | "RUN" | "MANUAL"

export interface SerializedError {
  category: "USER_ERROR" | "RUNTIME_ERROR"
  code: string
  message: string
  name?: string
  stack?: string
  cause?: SerializedError
  data?: Record<string, unknown>
}

export type PayloadLocation = "INLINE" | "EXTERNAL"

export interface WorkflowManifest {
  schemaVersion: 1
  projectId: string
  versionId: string
  builtAt: number
  builderVersion: string
  capabilities: string[]
  workflows: WorkflowManifestEntry[]
  eventFilters: EventFilterManifestEntry[]
  bindings: Record<string, { type: "d1" | "r2" | "kv" | "queue"; name: string }>
  environments: Record<string, { customDomain?: string }>
}

export interface WorkflowManifestEntry {
  id: string
  version: string
  inputSchema?: unknown
  outputSchema?: unknown
  concurrency?: ManifestConcurrencyPolicy
  steps: ManifestStep[]
  schedules: ManifestSchedule[]
  defaultRuntime: "edge" | "node"
  hasCompensation: boolean
  sourceLocation: { file: string; line: number }
}

export interface ManifestConcurrencyPolicy {
  key?: string
  limit?: number
  strategy?: "queue" | "cancel-in-progress" | "cancel-newest" | "round-robin"
}

export interface ManifestStep {
  id: string
  runtime: "edge" | "node"
  hasCompensation: boolean
  sourceLocation: { file: string; line: number }
}

export interface ManifestSchedule {
  cron?: string
  every?: string | number
  at?: string
  timezone?: string
  input?: unknown
  enabled?: boolean
  overlap?: "skip" | "queue" | "allow"
  environments?: ("production" | "preview" | "development")[]
  name?: string
}

export interface EventFilterManifestEntry {
  /** Stable id derived from `payloadHash` of the canonicalized declaration. */
  id: string
  /** Event name the filter targets — matches `EventEnvelope.name`. */
  eventType: string
  /**
   * Optional structured `where` predicate. When absent, every event of the
   * matching `eventType` fires the target workflow. Concrete shape lives in
   * `@voyantjs/workflows/events` (`PredicateExpr`); the protocol declares
   * it as an opaque object so old orchestrators that don't understand the
   * shape don't have to evaluate it.
   */
  where?: unknown
  /**
   * Optional input mapper. When absent, the workflow input = `envelope.data`.
   * Concrete shape lives in `@voyantjs/workflows/events` (`InputMapper`).
   */
  input?: unknown
  /** Content-derived hash of the canonicalized declaration. */
  payloadHash: string
  /** Workflow id this filter triggers. */
  targetWorkflowId: string
}

// WebSocket stream events — full union in docs/runtime-protocol.md §6.2.
export type StreamEvent =
  | {
      kind: "step.started"
      eventId: string
      at: number
      stepId: string
      runtime: "edge" | "node"
      machine?: string
    }
  | {
      kind: "step.ok"
      eventId: string
      at: number
      stepId: string
      attempt: number
      durationMs: number
      output?: unknown
    }
  | {
      kind: "step.err"
      eventId: string
      at: number
      stepId: string
      attempt: number
      error: SerializedError
    }
  | { kind: "step.skipped"; eventId: string; at: number; stepId: string; reason: string }
  | {
      kind: "step.compensated"
      eventId: string
      at: number
      stepId: string
      status: "ok" | "err"
      error?: SerializedError
    }
  | {
      kind: "waitpoint.registered"
      eventId: string
      at: number
      waitpointId: string
      waitpointKind: WaitpointKind
      meta: Record<string, unknown>
    }
  | {
      kind: "waitpoint.resolved"
      eventId: string
      at: number
      waitpointId: string
      payload?: unknown
      source: "live" | "inbox" | "replay"
    }
  | { kind: "metadata.changed"; eventId: string; at: number; metadata: Record<string, unknown> }
  | {
      kind: "stream.chunk"
      eventId: string
      at: number
      streamId: string
      chunk: unknown
      encoding: "json" | "text" | "base64"
      final: boolean
    }
  | {
      kind: "log"
      eventId: string
      at: number
      level: "info" | "warn" | "error"
      message: string
      stepId?: string
      data?: object
    }
  | { kind: "version.rebased"; eventId: string; at: number; fromVersion: string; toVersion: string }
  | { kind: "run.cancelled"; eventId: string; at: number; reason?: string }
  | {
      kind: "run.finished"
      eventId: string
      at: number
      status: string
      output?: unknown
      error?: SerializedError
    }

// Shared envelope for journal events written by the orchestrator,
// the tenant worker, or a node-runtime container. Concrete `kind`
// discriminants are owned by the emitting layer.
export interface JournalEventEnvelope<TKind extends string = string, TData = unknown> {
  eventId: string
  runId: string
  createdAt: number
  kind: TKind
  data: TData
  snapshotId?: string
  writtenBy: "orchestrator" | "tenant" | "node"
}

export interface PublicAccessTokenClaims {
  sub: "pat"
  tenantId: string
  environment: "production" | "preview" | "development"
  scope: ("read" | "trigger" | "cancel")[]
  target:
    | { kind: "run"; runId: string }
    | { kind: "workflow"; workflowId: string }
    | { kind: "tag"; tag: string }
  exp: number
}

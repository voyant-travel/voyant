// @voyant-travel/workflows/protocol
//
// Wire-protocol types shared with the orchestrator. Full contract
// in docs/runtime-protocol.md; types here are exported so callers
// (test harness, adapters, dashboards) can build and inspect wire
// payloads without reaching into runtime internals.

import type { JournalSlice, WaitpointResolutionEntry } from "../runtime/journal.js"

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
  capabilities: WorkflowReleaseCapabilities
  workflows: WorkflowManifestEntry[]
  eventFilters: EventFilterManifestEntry[]
  diagnostics: WorkflowManifestDiagnostic[]
  bundle?: WorkflowManifestBundle
  bindings: Record<string, { type: "d1" | "r2" | "kv" | "queue"; name: string }>
  environments: Record<string, { customDomain?: string }>
}

export interface WorkflowManifestEntry {
  id: string
  displayName?: string
  description?: string
  /** Workflow-level compute-time budget, normalized from `WorkflowConfig.timeout`. */
  timeoutMs?: number
  capabilities: WorkflowDefinitionCapabilities
  version: string
  inputSchema?: unknown
  outputSchema?: unknown
  concurrency?: ManifestConcurrencyPolicy
  steps: ManifestStep[]
  schedules: ManifestSchedule[]
  defaultRuntime: "node"
  hasCompensation: boolean
  sourceLocation: { file: string; line: number }
}

export interface WorkflowReleaseCapabilities {
  trigger: boolean
  events: boolean
  schedules: boolean
  rerun: boolean
  resume: boolean
  cancel: boolean
  humanApproval: boolean
  stepRerun: boolean
}

export interface WorkflowDefinitionCapabilities {
  canTrigger: boolean
  canRerun: boolean
  canResume: boolean
  canCancel: boolean
  hasSchedules: boolean
  supportsEvents: boolean
  supportsHumanApproval: boolean
  supportsStepRerun: boolean
}

export interface WorkflowManifestBundle {
  artifactName?: string
  sizeBytes?: number
  hash?: string
  hashAlgorithm?: "sha256" | "sha512" | (string & {})
}

export interface WorkflowBundleReference {
  key?: string
  url?: string
  signedUrl?: string
  hash?: string
  hashAlgorithm?: "sha256" | "sha512" | (string & {})
  sizeBytes?: number
}

export interface WorkflowPayloadReference {
  location: PayloadLocation
  key?: string
  url?: string
  hash?: string
  hashAlgorithm?: "sha256" | "sha512" | (string & {})
  sizeBytes?: number
  contentType?: string
}

export interface WorkflowJournalReference {
  location: PayloadLocation
  key?: string
  url?: string
  hash?: string
  hashAlgorithm?: "sha256" | "sha512" | (string & {})
}

export interface WorkflowManifestDiagnostic {
  code: string
  severity: "info" | "warning" | "error"
  message: string
  sourceLocation?: { file: string; line?: number; column?: number }
}

export interface ManifestConcurrencyPolicy {
  key?: string
  limit?: number
  strategy?: "queue" | "cancel-in-progress" | "cancel-newest" | "round-robin"
}

export interface ManifestStep {
  id: string
  runtime: "node"
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
   * `@voyant-travel/workflows/events` (`PredicateExpr`); the protocol declares
   * it as an opaque object so old orchestrators that don't understand the
   * shape don't have to evaluate it.
   */
  where?: unknown
  /**
   * Optional input mapper. When absent, the workflow input = `envelope.data`.
   * Concrete shape lives in `@voyant-travel/workflows/events` (`InputMapper`).
   */
  input?: unknown
  /** Content-derived hash of the canonicalized declaration. */
  payloadHash: string
  /** Workflow id this filter triggers. */
  targetWorkflowId: string
}

export interface WorkflowWaitpointSource {
  clientWaitpointId: string
  kind: WaitpointKind
  meta: Record<string, unknown>
  timeoutMs?: number
}

export interface WorkflowWaitpointSnapshot {
  /** Framework-stable waitpoint id, usually the runtime client waitpoint id. */
  id: string
  /** Stable key Cloud can store and later address without re-deriving metadata. */
  key: string
  kind: WaitpointKind
  eventName?: string
  signalName?: string
  tokenId?: string
  expiresAt?: number
  timeoutMs?: number
  metadata: Record<string, unknown>
}

export type WorkflowWaitpointResumeTarget = WorkflowWaitpointSource | WorkflowWaitpointSnapshot

export interface WorkflowActivationFreshness {
  dispatchedAt: number
  expiresAt?: number
  attempt?: number
  leaseId?: string
}

export type WorkflowActivationMetadata =
  | {
      kind: "initial"
      workflowReleaseId?: string
      releaseId?: string
      bundle?: WorkflowBundleReference
      freshness?: WorkflowActivationFreshness
    }
  | WorkflowResumeActivationMetadata

export interface WorkflowResumeActivationMetadata {
  kind: "resume"
  workflowReleaseId?: string
  releaseId?: string
  bundle?: WorkflowBundleReference
  journalRef?: WorkflowJournalReference
  waitpoint: WorkflowWaitpointSnapshot
  resumePayloadRef?: WorkflowPayloadReference
  freshness?: WorkflowActivationFreshness
}

export interface ApplyWorkflowResumeInput {
  journal: JournalSlice
  waitpoints: readonly WorkflowWaitpointResumeTarget[]
  waitpointId?: string
  waitpointKey?: string
  parkedAt?: number
  payload?: unknown
  payloadRef?: WorkflowPayloadReference
  resolvedAt?: number
  matchedEventId?: string
  source?: WaitpointResolutionEntry["source"]
}

export type ApplyWorkflowResumeResult =
  | {
      ok: true
      journal: JournalSlice
      waitpoint: WorkflowWaitpointSnapshot
      resolution: WaitpointResolutionEntry
    }
  | {
      ok: false
      code: "missing_waitpoint_selector" | "waitpoint_not_found"
      message: string
    }

export function workflowWaitpointKey(waitpoint: WorkflowWaitpointResumeTarget): string {
  if (isWorkflowWaitpointSnapshot(waitpoint)) return waitpoint.key
  return `${waitpoint.kind}:${waitpoint.clientWaitpointId}`
}

export function snapshotWorkflowWaitpoint(
  waitpoint: WorkflowWaitpointResumeTarget,
  parkedAt = Date.now(),
): WorkflowWaitpointSnapshot {
  const metadata = {
    ...(isWorkflowWaitpointSnapshot(waitpoint) ? waitpoint.metadata : waitpoint.meta),
  }
  const timeoutMs = waitpoint.timeoutMs
  const wakeAt = typeof metadata.wakeAt === "number" ? metadata.wakeAt : undefined
  const expiresAt = isWorkflowWaitpointSnapshot(waitpoint)
    ? waitpoint.expiresAt
    : (wakeAt ??
      (typeof timeoutMs === "number" && timeoutMs > 0 ? parkedAt + timeoutMs : undefined))

  const snapshot: WorkflowWaitpointSnapshot = {
    id: workflowWaitpointId(waitpoint),
    key: workflowWaitpointKey(waitpoint),
    kind: waitpoint.kind,
    metadata,
  }
  if (typeof timeoutMs === "number") snapshot.timeoutMs = timeoutMs
  if (typeof expiresAt === "number") snapshot.expiresAt = expiresAt
  if (waitpoint.kind === "EVENT") {
    const eventName = isWorkflowWaitpointSnapshot(waitpoint)
      ? waitpoint.eventName
      : typeof metadata.eventType === "string"
        ? metadata.eventType
        : undefined
    if (eventName) snapshot.eventName = eventName
  }
  if (waitpoint.kind === "SIGNAL") {
    const signalName = isWorkflowWaitpointSnapshot(waitpoint)
      ? waitpoint.signalName
      : typeof metadata.signalName === "string"
        ? metadata.signalName
        : undefined
    if (signalName) snapshot.signalName = signalName
  }
  if (waitpoint.kind === "MANUAL") {
    const tokenId = isWorkflowWaitpointSnapshot(waitpoint)
      ? waitpoint.tokenId
      : typeof metadata.tokenId === "string"
        ? metadata.tokenId
        : undefined
    if (tokenId) snapshot.tokenId = tokenId
  }
  return snapshot
}

export function applyWorkflowResumeToJournal(
  input: ApplyWorkflowResumeInput,
): ApplyWorkflowResumeResult {
  if (!input.waitpointId && !input.waitpointKey) {
    return {
      ok: false,
      code: "missing_waitpoint_selector",
      message: "resume requires waitpointId or waitpointKey",
    }
  }

  const matched = input.waitpoints.find((waitpoint) => {
    if (input.waitpointId && workflowWaitpointId(waitpoint) === input.waitpointId) return true
    return (
      input.waitpointKey !== undefined && workflowWaitpointKey(waitpoint) === input.waitpointKey
    )
  })

  if (!matched) {
    const selector = input.waitpointId
      ? `waitpointId=${input.waitpointId}`
      : `waitpointKey=${input.waitpointKey}`
    return {
      ok: false,
      code: "waitpoint_not_found",
      message: `no pending waitpoint matches ${selector}`,
    }
  }

  const journal = structuredClone(input.journal) as JournalSlice
  const resolution: WaitpointResolutionEntry = {
    kind: matched.kind,
    resolvedAt: input.resolvedAt ?? Date.now(),
    source: input.source ?? "live",
  }
  if ("payload" in input) resolution.payload = input.payload
  if (input.payloadRef) resolution.payloadRef = input.payloadRef
  if (input.matchedEventId) resolution.matchedEventId = input.matchedEventId
  journal.waitpointsResolved[workflowWaitpointId(matched)] = resolution

  return {
    ok: true,
    journal,
    waitpoint: snapshotWorkflowWaitpoint(matched, input.parkedAt ?? resolution.resolvedAt),
    resolution,
  }
}

function workflowWaitpointId(waitpoint: WorkflowWaitpointResumeTarget): string {
  return isWorkflowWaitpointSnapshot(waitpoint) ? waitpoint.id : waitpoint.clientWaitpointId
}

function isWorkflowWaitpointSnapshot(
  waitpoint: WorkflowWaitpointResumeTarget,
): waitpoint is WorkflowWaitpointSnapshot {
  return "id" in waitpoint
}

// WebSocket stream events — full union in docs/runtime-protocol.md §6.2.
export type StreamEvent =
  | {
      kind: "step.started"
      eventId: string
      at: number
      stepId: string
      runtime: "node"
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
// tenant runtime, or Node runner. Concrete `kind`
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

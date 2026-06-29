// Tenant-side view of the journal sent by the orchestrator on every
// `/__voyant/workflow-step` invocation.
//
// Wire shape defined in docs/runtime-protocol.md §2.1 (JournalSlice).

import type { SerializedError, WorkflowPayloadReference } from "../protocol/index.js"
import type { WaitpointKind } from "../types.js"

export interface StepJournalEntry {
  attempt: number
  status: "ok" | "err"
  output?: unknown
  error?: SerializedError
  startedAt: number
  finishedAt: number
  /**
   * Runtime that executed the step. Informational only — doesn't affect replay.
   */
  runtime?: "node"
}

export interface WaitpointResolutionEntry {
  kind: WaitpointKind
  resolvedAt: number
  matchedEventId?: string
  payload?: unknown
  payloadRef?: WorkflowPayloadReference
  source: "live" | "inbox" | "replay"
  /** Populated for RUN waitpoints when the child run ended in a failure state. */
  error?: SerializedError
}

export interface CompensationJournalEntry {
  status: "ok" | "err"
  finishedAt: number
  error?: SerializedError
}

export interface JournalSlice {
  stepResults: Record<string, StepJournalEntry>
  waitpointsResolved: Record<string, WaitpointResolutionEntry>
  compensationsRun: Record<string, CompensationJournalEntry>
  metadataState: Record<string, unknown>
  /**
   * Stream ids whose generator has already been consumed in a prior
   * invocation. The orchestrator already has the chunks on the run
   * record; replaying the body must skip re-iterating the source
   * (generators often have side effects — LLM calls, file reads,
   * billable API usage).
   */
  streamsCompleted: Record<string, { chunkCount: number }>
}

export function emptyJournal(): JournalSlice {
  return {
    stepResults: {},
    waitpointsResolved: {},
    compensationsRun: {},
    metadataState: {},
    streamsCompleted: {},
  }
}

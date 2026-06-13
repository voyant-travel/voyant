import {
  applyWorkflowResumeToJournal,
  PROTOCOL_VERSION,
  type ProtocolVersion,
  type WorkflowActivationFreshness,
  type WorkflowBundleReference,
  type WorkflowJournalReference,
  type WorkflowPayloadReference,
  type WorkflowWaitpointResumeTarget,
  type WorkflowWaitpointSnapshot,
} from "../protocol/index.js"
import type { JournalSlice } from "../runtime/journal.js"
import type { WorkflowStepRequest } from "./index.js"

export interface BuildResumeStepRequestInput {
  runId: string
  workflowId: string
  workflowVersion: string
  input: unknown
  journal: JournalSlice
  pendingWaitpoints: readonly WorkflowWaitpointResumeTarget[]
  waitpointId?: string
  waitpointKey?: string
  parkedAt?: number
  resumePayload?: unknown
  resumePayloadRef?: WorkflowPayloadReference
  resolvedAt?: number
  matchedEventId?: string
  source?: "live" | "inbox" | "replay"
  protocolVersion?: ProtocolVersion
  invocationCount: number
  environment: "production" | "preview" | "development"
  deadline: number
  tenantMeta: WorkflowStepRequest["tenantMeta"]
  runMeta: WorkflowStepRequest["runMeta"]
  workflowReleaseId?: string
  releaseId?: string
  bundle?: WorkflowBundleReference
  journalRef?: WorkflowJournalReference
  freshness?: WorkflowActivationFreshness
}

export type BuildResumeStepRequestResult =
  | {
      ok: true
      request: WorkflowStepRequest
      waitpoint: WorkflowWaitpointSnapshot
    }
  | {
      ok: false
      code: "missing_waitpoint_selector" | "waitpoint_not_found"
      message: string
    }

export function buildResumeStepRequest(
  input: BuildResumeStepRequestInput,
): BuildResumeStepRequestResult {
  const applied = applyWorkflowResumeToJournal({
    journal: input.journal,
    waitpoints: input.pendingWaitpoints,
    waitpointId: input.waitpointId,
    waitpointKey: input.waitpointKey,
    parkedAt: input.parkedAt,
    payload: input.resumePayload,
    payloadRef: input.resumePayloadRef,
    resolvedAt: input.resolvedAt,
    matchedEventId: input.matchedEventId,
    source: input.source,
  })

  if (!applied.ok) return applied

  return {
    ok: true,
    waitpoint: applied.waitpoint,
    request: {
      protocolVersion: input.protocolVersion ?? PROTOCOL_VERSION,
      runId: input.runId,
      workflowId: input.workflowId,
      workflowVersion: input.workflowVersion,
      invocationCount: input.invocationCount,
      input: input.input,
      journal: applied.journal,
      environment: input.environment,
      deadline: input.deadline,
      tenantMeta: input.tenantMeta,
      runMeta: input.runMeta,
      activation: {
        kind: "resume",
        workflowReleaseId: input.workflowReleaseId,
        releaseId: input.releaseId,
        bundle: input.bundle,
        journalRef: input.journalRef,
        waitpoint: applied.waitpoint,
        resumePayloadRef: input.resumePayloadRef,
        freshness: input.freshness,
      },
    },
  }
}

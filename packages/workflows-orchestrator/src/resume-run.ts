import { emptyJournal } from "./journal-helpers.js"
import type { JournalSlice, RunRecord, StepJournalEntry } from "./types.js"

export interface BuildResumeJournalInput {
  parent: RunRecord
  resumeFromStep?: string
  seedResults?: Record<string, unknown>
  now?: () => number
}

export interface BuildResumeJournalResult {
  resumeFromStep: string
  journal: JournalSlice
  metadataAppliedCount: number
}

export interface BuildSeededResumeJournalInput {
  parentRunId: string
  resumeFromStep: string
  seedResults: Record<string, unknown>
  metadataState?: Record<string, unknown>
  metadataAppliedCount?: number
  now?: () => number
}

export function buildResumeJournal(input: BuildResumeJournalInput): BuildResumeJournalResult {
  const resumeFromStep = input.resumeFromStep ?? findFirstFailedStep(input.parent)
  if (!resumeFromStep) {
    throw new Error(
      `run "${input.parent.id}" has no failed step; pass resumeFromStep explicitly to resume it`,
    )
  }

  const journal = emptyJournal()
  journal.metadataState = structuredClone(input.parent.journal.metadataState) as Record<
    string,
    unknown
  >

  if (input.seedResults) {
    return buildSeededResumeJournal({
      parentRunId: input.parent.id,
      resumeFromStep,
      seedResults: input.seedResults,
      metadataState: journal.metadataState,
      metadataAppliedCount: input.parent.metadataAppliedCount,
      now: input.now,
    })
  }

  for (const [stepId, entry] of Object.entries(input.parent.journal.stepResults)) {
    if (stepId === resumeFromStep) break
    if (entry.status !== "ok") {
      throw new Error(
        `step "${stepId}" completed before "${resumeFromStep}" but is not successful; cannot seed resume journal`,
      )
    }
    journal.stepResults[stepId] = structuredClone(entry) as StepJournalEntry
  }

  return {
    resumeFromStep,
    journal,
    metadataAppliedCount: input.parent.metadataAppliedCount,
  }
}

export function buildSeededResumeJournal(
  input: BuildSeededResumeJournalInput,
): BuildResumeJournalResult {
  const journal = emptyJournal()
  journal.metadataState = input.metadataState
    ? (structuredClone(input.metadataState) as Record<string, unknown>)
    : {}
  const now = input.now ?? (() => Date.now())
  let at = now()
  for (const [stepId, output] of Object.entries(input.seedResults)) {
    journal.stepResults[stepId] = seededStepEntry(output, at)
    at += 1
  }
  return {
    resumeFromStep: input.resumeFromStep,
    journal,
    metadataAppliedCount: input.metadataAppliedCount ?? 0,
  }
}

export type SeedResultsValidation =
  | { ok: true; seedResults: Record<string, unknown> }
  | { ok: false; message: string }

const SEED_RESULTS_MAX_ENTRIES = 256
const SEED_RESULTS_MAX_STEP_ID_LENGTH = 200
const SEED_RESULTS_MAX_SERIALIZED_CHARS = 1_000_000
// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control chars is the point
const CONTROL_CHARS = /[\x00-\x1f\x7f]/

/**
 * Strict structural validation for caller-supplied `seedResults`
 * (`POST /api/runs/:id/resume`). Seeded entries are written verbatim
 * into the new run's journal as already-completed steps, so they let
 * the caller assert "this step ran and produced this output" — they
 * must be gated behind an operator credential AND shape-checked:
 * a record of bounded, control-character-free step ids to
 * JSON-serializable values, bounded in count and total size.
 */
export function validateSeedResults(value: unknown): SeedResultsValidation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, message: "seedResults must be an object of stepId → output" }
  }
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length > SEED_RESULTS_MAX_ENTRIES) {
    return {
      ok: false,
      message: `seedResults may contain at most ${SEED_RESULTS_MAX_ENTRIES} entries`,
    }
  }
  for (const [stepId, output] of entries) {
    if (stepId.length === 0 || stepId.length > SEED_RESULTS_MAX_STEP_ID_LENGTH) {
      return {
        ok: false,
        message: `seedResults step ids must be 1-${SEED_RESULTS_MAX_STEP_ID_LENGTH} characters`,
      }
    }
    if (CONTROL_CHARS.test(stepId)) {
      return { ok: false, message: "seedResults step ids must not contain control characters" }
    }
    let serialized: string | undefined
    try {
      serialized = JSON.stringify(output)
    } catch {
      return { ok: false, message: `seedResults["${stepId}"] is not JSON-serializable` }
    }
    if (serialized === undefined) {
      return { ok: false, message: `seedResults["${stepId}"] is not JSON-serializable` }
    }
    if (serialized.length > SEED_RESULTS_MAX_SERIALIZED_CHARS) {
      return {
        ok: false,
        message: `seedResults["${stepId}"] exceeds the ${SEED_RESULTS_MAX_SERIALIZED_CHARS}-character serialized limit`,
      }
    }
  }
  return { ok: true, seedResults: value as Record<string, unknown> }
}

function findFirstFailedStep(parent: RunRecord): string | undefined {
  for (const [stepId, entry] of Object.entries(parent.journal.stepResults)) {
    if (entry.status === "err") return stepId
  }
  return undefined
}

function seededStepEntry(output: unknown, at: number): StepJournalEntry {
  return {
    attempt: 1,
    status: "ok",
    output,
    startedAt: at,
    finishedAt: at,
  }
}

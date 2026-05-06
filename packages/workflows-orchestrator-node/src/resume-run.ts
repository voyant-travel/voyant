import {
  emptyJournal,
  type JournalSlice,
  type RunRecord,
  type StepJournalEntry,
} from "@voyantjs/workflows-orchestrator"

export interface BuildResumeJournalInput {
  parent: RunRecord
  resumeFromStep?: string
  seedResults?: Record<string, unknown>
  now?: () => number
}

export interface BuildResumeJournalResult {
  resumeFromStep: string
  journal: JournalSlice
}

export interface BuildSeededResumeJournalInput {
  parentRunId: string
  resumeFromStep: string
  seedResults: Record<string, unknown>
  metadataState?: Record<string, unknown>
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

  return { resumeFromStep, journal }
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
  return { resumeFromStep: input.resumeFromStep, journal }
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

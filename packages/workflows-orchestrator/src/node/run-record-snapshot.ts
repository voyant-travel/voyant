import type { JournalSlice, RunRecord } from "./core.js"

export interface RunRecordSnapshotBase {
  entryFile?: string
  replayOf?: string
  tags?: string[]
}

export interface RunRecordSnapshot extends RunRecordSnapshotBase {
  id: string
  workflowId: string
  status: string
  startedAt: number
  completedAt?: number
  durationMs?: number
  result: Record<string, unknown>
  input: unknown
  runRecord: RunRecord
}

export function recordToSnapshot(
  record: RunRecord,
  base?: RunRecordSnapshotBase,
): RunRecordSnapshot {
  const events = eventsFromJournal(record.journal)
  const steps = stepsFromJournal(record.journal)
  const compensations = Object.entries(record.journal.compensationsRun).map(([stepId, entry]) => ({
    stepId,
    status: entry.status,
    error: entry.error,
  }))

  const result: Record<string, unknown> = {
    status: record.status,
    steps,
    events,
    metadata: record.journal.metadataState,
    compensations,
    streams: record.streams,
    invocations: record.invocationCount,
  }
  if (record.output !== undefined) result.output = record.output
  if (record.error !== undefined) result.error = record.error

  return {
    ...base,
    id: record.id,
    workflowId: record.workflowId,
    status: record.status,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    durationMs:
      record.completedAt !== undefined ? record.completedAt - record.startedAt : undefined,
    tags: record.tags.length > 0 ? record.tags : base?.tags,
    input: record.input,
    result,
    runRecord: record,
  }
}

export function snapshotToRecord(snapshot: { id: string; runRecord?: RunRecord }): RunRecord {
  const record = snapshot.runRecord
  if (!record) {
    throw new Error(
      `snapshotToRecord: run "${snapshot.id}" has no embedded runRecord. ` +
        `Snapshots produced by recordToSnapshot() must preserve it.`,
    )
  }
  return record
}

function stepsFromJournal(journal: JournalSlice): {
  id: string
  status: "ok" | "err"
  duration: number
  output?: unknown
}[] {
  return Object.entries(journal.stepResults).map(([id, entry]) => ({
    id,
    status: entry.status,
    duration: entry.finishedAt - entry.startedAt,
    output: entry.output,
  }))
}

function eventsFromJournal(journal: JournalSlice): { type: string; at: number; data: unknown }[] {
  const events: { type: string; at: number; data: unknown }[] = []

  for (const [stepId, entry] of Object.entries(journal.stepResults)) {
    events.push({
      type: "step.started",
      at: entry.startedAt,
      data: { stepId, attempt: entry.attempt, runtime: entry.runtime },
    })
    if (entry.status === "ok") {
      events.push({
        type: "step.ok",
        at: entry.finishedAt,
        data: { stepId, attempt: entry.attempt, output: entry.output },
      })
    } else {
      events.push({
        type: "step.err",
        at: entry.finishedAt,
        data: {
          stepId,
          attempt: entry.attempt,
          error: {
            message: entry.error?.message ?? "unknown",
            code: entry.error?.code ?? "UNKNOWN",
          },
        },
      })
    }
  }

  const steppedTimestamps = Object.values(journal.stepResults).map((entry) => entry.finishedAt)
  for (const [waitpointId, entry] of Object.entries(journal.waitpointsResolved)) {
    const priorTimestamps = steppedTimestamps.filter((t) => t <= entry.resolvedAt)
    const registeredAt =
      priorTimestamps.length > 0 ? Math.max(...priorTimestamps) : entry.resolvedAt
    events.push({
      type: "waitpoint.registered",
      at: registeredAt,
      data: { waitpointId, waitpointKind: entry.kind, meta: {} },
    })
    events.push({
      type: "waitpoint.resolved",
      at: entry.resolvedAt,
      data: {
        waitpointId,
        waitpointKind: entry.kind,
        source: entry.source,
        payload: entry.payload,
        error: entry.error ? { message: entry.error.message, code: entry.error.code } : undefined,
      },
    })
  }

  for (const [stepId, entry] of Object.entries(journal.compensationsRun)) {
    events.push({
      type: "step.compensated",
      at: entry.finishedAt,
      data: {
        stepId,
        status: entry.status,
        error: entry.error ? { message: entry.error.message, code: entry.error.code } : undefined,
      },
    })
  }

  events.sort((a, b) => a.at - b.at)
  return events
}

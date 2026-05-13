import type { AgentRunnerLedgerStore } from "./run-ledger-store.js"
import type { SupervisorLeaseRecord } from "./supervisor-tick-store.js"

export async function persistRunLedgerSupervisorTick({
  recordedAt,
  repository,
  result,
  runLedgerStore,
}: {
  recordedAt: Date
  repository?: string
  result: unknown
  runLedgerStore?: AgentRunnerLedgerStore
}) {
  if (!runLedgerStore) return null
  if (!repository) return { persisted: false, reason: "missing_repository" }

  await runLedgerStore.recordSupervisorTick({
    recordedAt: recordedAt.toISOString(),
    repository,
    result,
  })
  return { persisted: true }
}

export function normalizeDailyLeaseLimit(value: number | undefined) {
  if (!value) return null
  return Math.min(Math.max(Math.trunc(value), 1), 100)
}

export function isLeasedResult(result: unknown): result is { leased: true } {
  return Boolean(
    result && typeof result === "object" && "leased" in result && result.leased === true,
  )
}

export function createSupervisorLeaseRecord({
  leasedAt,
  repository,
  result,
}: {
  leasedAt: Date
  repository: string
  result: unknown
}): SupervisorLeaseRecord {
  return {
    id: leaseRecordId(leasedAt),
    leasedAt: leasedAt.toISOString(),
    repository,
    result,
  }
}

export function bearerToken(header: string | undefined) {
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim()
}

export function validationIssues(error: {
  issues: Array<{ path: Array<PropertyKey>; message: string }>
}) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }))
}

export function parseLimit(value: string | undefined) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function parseSince(value: string | undefined) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? false : date.toISOString()
}

function leaseRecordId(leasedAt: Date) {
  return `lease_${leasedAt.getTime()}_${Math.random().toString(36).slice(2)}`
}

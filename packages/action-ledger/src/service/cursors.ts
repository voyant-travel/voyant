import type { ActionApproval, ActionDelegation, ActionLedgerEntry } from "../schema.js"

const DEFAULT_LIST_LIMIT = 50
const MAX_LIST_LIMIT = 200

function normalizeListLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIST_LIMIT
  if (!Number.isFinite(limit)) return DEFAULT_LIST_LIMIT
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIST_LIMIT)
}

function toActionLedgerListCursor(entry: Pick<ActionLedgerEntry, "occurredAt" | "id">) {
  return {
    occurredAt: serializeCursorDate(entry.occurredAt),
    id: entry.id,
  }
}

function toActionApprovalListCursor(row: Pick<ActionApproval, "createdAt" | "id">) {
  return {
    createdAt: serializeCursorDate(row.createdAt),
    id: row.id,
  }
}

function toActionDelegationListCursor(row: Pick<ActionDelegation, "createdAt" | "id">) {
  return {
    createdAt: serializeCursorDate(row.createdAt),
    id: row.id,
  }
}

function serializeCursorDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Action ledger cursor occurredAt must be a valid timestamp")
  }
  return date.toISOString()
}

function parseCursorDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Action ledger cursor occurredAt must be a valid timestamp")
  }
  return date
}

export {
  normalizeListLimit,
  parseCursorDate,
  toActionApprovalListCursor,
  toActionDelegationListCursor,
  toActionLedgerListCursor,
}

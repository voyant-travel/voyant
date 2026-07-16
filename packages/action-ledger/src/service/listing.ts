import type { AnyDrizzleDb } from "@voyant-travel/db"
import { asc, desc } from "drizzle-orm"

import { actionApprovals, actionDelegations, actionLedgerEntries } from "../schema.js"
import {
  normalizeListLimit,
  toActionApprovalListCursor,
  toActionDelegationListCursor,
  toActionLedgerListCursor,
} from "./cursors.js"
import {
  buildActionApprovalsPredicate,
  buildActionDelegationsPredicate,
  buildActionLedgerEntriesPredicate,
} from "./predicates.js"
import type {
  ListActionApprovalsInput,
  ListActionApprovalsResult,
  ListActionDelegationsInput,
  ListActionDelegationsResult,
  ListActionLedgerEntriesInput,
  ListActionLedgerEntriesResult,
} from "./types.js"

export async function listEntries(
  db: AnyDrizzleDb,
  input: ListActionLedgerEntriesInput = {},
): Promise<ListActionLedgerEntriesResult> {
  const limit = normalizeListLimit(input.limit)
  const predicate = buildActionLedgerEntriesPredicate(input)
  const direction = input.sortDir === "asc" ? asc : desc

  let query = db.select().from(actionLedgerEntries).$dynamic()
  if (predicate) {
    query = query.where(predicate)
  }

  const rows = await query
    .orderBy(direction(actionLedgerEntries.occurredAt), direction(actionLedgerEntries.id))
    .limit(limit + 1)

  const entries = rows.slice(0, limit)
  return {
    entries,
    nextCursor:
      rows.length > limit && entries.length > 0
        ? toActionLedgerListCursor(entries[entries.length - 1]!)
        : null,
  }
}

export async function listApprovals(
  db: AnyDrizzleDb,
  input: ListActionApprovalsInput = {},
): Promise<ListActionApprovalsResult> {
  const limit = normalizeListLimit(input.limit)
  const predicate = buildActionApprovalsPredicate(input)

  let query = db.select().from(actionApprovals).$dynamic()
  if (predicate) {
    query = query.where(predicate)
  }

  const rows = await query
    .orderBy(desc(actionApprovals.createdAt), desc(actionApprovals.id))
    .limit(limit + 1)

  const approvals = rows.slice(0, limit)
  return {
    approvals,
    nextCursor:
      rows.length > limit && approvals.length > 0
        ? toActionApprovalListCursor(approvals[approvals.length - 1]!)
        : null,
  }
}

export async function listDelegations(
  db: AnyDrizzleDb,
  input: ListActionDelegationsInput = {},
): Promise<ListActionDelegationsResult> {
  const limit = normalizeListLimit(input.limit)
  const predicate = buildActionDelegationsPredicate(input)

  let query = db.select().from(actionDelegations).$dynamic()
  if (predicate) {
    query = query.where(predicate)
  }

  const rows = await query
    .orderBy(desc(actionDelegations.createdAt), desc(actionDelegations.id))
    .limit(limit + 1)

  const delegations = rows.slice(0, limit)
  return {
    delegations,
    nextCursor:
      rows.length > limit && delegations.length > 0
        ? toActionDelegationListCursor(delegations[delegations.length - 1]!)
        : null,
  }
}

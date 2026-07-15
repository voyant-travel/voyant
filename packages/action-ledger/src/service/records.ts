import type { AnyDrizzleDb } from "@voyant-travel/db"
import { eq } from "drizzle-orm"

import {
  actionApprovals,
  actionDelegations,
  actionLedgerEntries,
  actionLedgerPayloads,
  actionMutationDetails,
  actionSensitiveReadDetails,
} from "../schema.js"
import type {
  GetActionApprovalResult,
  GetActionDelegationResult,
  GetActionLedgerEntryResult,
} from "./types.js"

export async function getEntry(
  db: AnyDrizzleDb,
  id: string,
): Promise<GetActionLedgerEntryResult | null> {
  const [entry] = await db
    .select()
    .from(actionLedgerEntries)
    .where(eq(actionLedgerEntries.id, id))
    .limit(1)

  if (!entry) return null

  const [[mutationDetail], [sensitiveReadDetail], payloads] = await Promise.all([
    db.select().from(actionMutationDetails).where(eq(actionMutationDetails.actionId, id)).limit(1),
    db
      .select()
      .from(actionSensitiveReadDetails)
      .where(eq(actionSensitiveReadDetails.actionId, id))
      .limit(1),
    db.select().from(actionLedgerPayloads).where(eq(actionLedgerPayloads.actionId, id)),
  ])

  return {
    entry,
    mutationDetail: mutationDetail ?? null,
    sensitiveReadDetail: sensitiveReadDetail ?? null,
    payloads,
  }
}

export async function getApproval(
  db: AnyDrizzleDb,
  id: string,
): Promise<GetActionApprovalResult | null> {
  const [approval] = await db
    .select()
    .from(actionApprovals)
    .where(eq(actionApprovals.id, id))
    .limit(1)

  if (!approval) return null

  return {
    approval,
    requestedAction: await getEntry(db, approval.requestedActionId),
  }
}

export async function getDelegation(
  db: AnyDrizzleDb,
  id: string,
): Promise<GetActionDelegationResult | null> {
  const [delegation] = await db
    .select()
    .from(actionDelegations)
    .where(eq(actionDelegations.id, id))
    .limit(1)

  if (!delegation) return null
  return { delegation }
}

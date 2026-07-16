import type { AnyDrizzleDb } from "@voyant-travel/db"
import { and, eq } from "drizzle-orm"

import {
  type ActionApproval,
  type ActionLedgerEntry,
  actionApprovals,
  actionLedgerEntries,
  actionLedgerPayloads,
  actionMutationDetails,
  actionSensitiveReadDetails,
} from "../schema.js"
import { ActionLedgerIdempotencyConflictError } from "./errors.js"
import type { AppendActionLedgerEntryInput, AppendActionLedgerEntryResult } from "./types.js"

export async function insertEntry(
  db: AnyDrizzleDb,
  input: AppendActionLedgerEntryInput,
): Promise<AppendActionLedgerEntryResult> {
  const { mutationDetail, payloads, sensitiveReadDetail, ...entryInput } = input
  const [entry] = await db
    .insert(actionLedgerEntries)
    .values({
      ...entryInput,
      occurredAt: input.occurredAt,
    })
    .returning()

  if (!entry) {
    throw new Error("Action ledger insert did not return an entry")
  }

  if (mutationDetail) {
    await db.insert(actionMutationDetails).values({
      actionId: entry.id,
      ...mutationDetail,
    })
  }

  if (sensitiveReadDetail) {
    await db.insert(actionSensitiveReadDetails).values({
      actionId: entry.id,
      ...sensitiveReadDetail,
    })
  }

  if (payloads && payloads.length > 0) {
    await db.insert(actionLedgerPayloads).values(
      payloads.map((payload) => ({
        actionId: entry.id,
        ...payload,
      })),
    )
  }

  return { entry, replayed: false }
}

export async function findExistingIdempotentEntry(
  db: AnyDrizzleDb,
  input: AppendActionLedgerEntryInput,
): Promise<ActionLedgerEntry | null> {
  if (!input.idempotencyScope || !input.idempotencyKey) return null

  const [existing] = await db
    .select()
    .from(actionLedgerEntries)
    .where(
      and(
        eq(actionLedgerEntries.idempotencyScope, input.idempotencyScope),
        eq(actionLedgerEntries.actionName, input.actionName),
        eq(actionLedgerEntries.targetType, input.targetType),
        eq(actionLedgerEntries.targetId, input.targetId),
        eq(actionLedgerEntries.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1)

  return existing ?? null
}

export async function findApprovalForRequestedAction(
  db: AnyDrizzleDb,
  requestedActionId: string,
): Promise<ActionApproval | null> {
  const [approval] = await db
    .select()
    .from(actionApprovals)
    .where(eq(actionApprovals.requestedActionId, requestedActionId))
    .limit(1)

  return approval ?? null
}

export async function findApprovalById(
  db: AnyDrizzleDb,
  id: string,
): Promise<ActionApproval | null> {
  const [approval] = await db
    .select()
    .from(actionApprovals)
    .where(eq(actionApprovals.id, id))
    .limit(1)

  return approval ?? null
}

export function assertSameFingerprint(entry: ActionLedgerEntry, fingerprint: string | null): void {
  if (entry.idempotencyFingerprint !== fingerprint) {
    throw new ActionLedgerIdempotencyConflictError(entry.id)
  }
}

import type { AnyDrizzleDb } from "@voyantjs/db"
import { and, eq } from "drizzle-orm"

import {
  type ActionLedgerEntry,
  actionLedgerEntries,
  actionLedgerRelayOutbox,
  actionMutationDetails,
  actionSensitiveReadDetails,
  type NewActionLedgerEntry,
  type NewActionMutationDetail,
  type NewActionSensitiveReadDetail,
} from "./schema.js"

export class ActionLedgerIdempotencyConflictError extends Error {
  readonly existingActionId: string

  constructor(existingActionId: string) {
    super("Action ledger idempotency key was reused with a different fingerprint")
    this.name = "ActionLedgerIdempotencyConflictError"
    this.existingActionId = existingActionId
  }
}

export interface AppendActionLedgerEntryInput
  extends Omit<NewActionLedgerEntry, "id" | "createdAt" | "occurredAt"> {
  occurredAt?: Date
  mutationDetail?: Omit<NewActionMutationDetail, "actionId">
  sensitiveReadDetail?: Omit<NewActionSensitiveReadDetail, "actionId">
  enqueueRelay?: boolean | { payloadRef?: string | null }
}

export interface AppendActionLedgerEntryResult {
  entry: ActionLedgerEntry
  replayed: boolean
}

export const actionLedgerService = {
  async appendEntry(
    db: AnyDrizzleDb,
    input: AppendActionLedgerEntryInput,
  ): Promise<AppendActionLedgerEntryResult> {
    const existing = await findExistingIdempotentEntry(db, input)
    if (existing) {
      assertSameFingerprint(existing, input.idempotencyFingerprint ?? null)
      return { entry: existing, replayed: true }
    }

    try {
      return await insertEntry(db, input)
    } catch (error) {
      const racedExisting = await findExistingIdempotentEntry(db, input)
      if (racedExisting) {
        assertSameFingerprint(racedExisting, input.idempotencyFingerprint ?? null)
        return { entry: racedExisting, replayed: true }
      }
      throw error
    }
  },
}

async function insertEntry(
  db: AnyDrizzleDb,
  input: AppendActionLedgerEntryInput,
): Promise<AppendActionLedgerEntryResult> {
  const [entry] = await db
    .insert(actionLedgerEntries)
    .values({
      ...input,
      occurredAt: input.occurredAt,
    })
    .returning()

  if (!entry) {
    throw new Error("Action ledger insert did not return an entry")
  }

  if (input.mutationDetail) {
    await db.insert(actionMutationDetails).values({
      actionId: entry.id,
      ...input.mutationDetail,
    })
  }

  if (input.sensitiveReadDetail) {
    await db.insert(actionSensitiveReadDetails).values({
      actionId: entry.id,
      ...input.sensitiveReadDetail,
    })
  }

  if (input.enqueueRelay) {
    const payloadRef = typeof input.enqueueRelay === "object" ? input.enqueueRelay.payloadRef : null
    await db.insert(actionLedgerRelayOutbox).values({
      actionId: entry.id,
      organizationId: entry.organizationId,
      payloadRef: payloadRef ?? null,
      relayStatus: "pending",
    })
  }

  return { entry, replayed: false }
}

async function findExistingIdempotentEntry(
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

function assertSameFingerprint(entry: ActionLedgerEntry, fingerprint: string | null): void {
  if (entry.idempotencyFingerprint !== fingerprint) {
    throw new ActionLedgerIdempotencyConflictError(entry.id)
  }
}

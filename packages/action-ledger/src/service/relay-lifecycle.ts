import type { AnyDrizzleDb } from "@voyant-travel/db"
import { and, eq, sql } from "drizzle-orm"

import { type ActionLedgerRelayOutbox, actionLedgerRelayOutbox } from "../schema.js"
import { normalizeListLimit, parseCursorDate } from "./cursors.js"
import {
  type ActionLedgerRelayOutboxSqlRow,
  actionLedgerRelayOutboxFromSqlRow,
} from "./relay-outbox.js"
import type {
  ClaimActionLedgerRelayOutboxInput,
  ClaimActionLedgerRelayOutboxResult,
  MarkActionLedgerRelayOutboxFailedInput,
  MarkActionLedgerRelayOutboxSucceededInput,
} from "./types.js"

export async function claimRelayOutbox(
  db: AnyDrizzleDb,
  input: ClaimActionLedgerRelayOutboxInput = {},
): Promise<ClaimActionLedgerRelayOutboxResult> {
  const limit = normalizeListLimit(input.limit)
  const dueAt = input.dueAt ? parseCursorDate(input.dueAt) : new Date()
  const organizationId = input.organizationId ?? null
  const result = await db.execute<ActionLedgerRelayOutboxSqlRow>(sql`
      WITH due AS (
        SELECT id
        FROM action_ledger_outbox
        WHERE relay_status IN ('pending', 'failed')
          AND (${organizationId}::text IS NULL OR organization_id = ${organizationId})
          AND (next_retry_at IS NULL OR next_retry_at <= ${dueAt})
        ORDER BY created_at ASC, id ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE action_ledger_outbox AS outbox
      SET relay_status = 'processing',
          attempt_count = outbox.attempt_count + 1,
          last_error = NULL,
          processed_at = NULL
      FROM due
      WHERE outbox.id = due.id
      RETURNING
        outbox.id,
        outbox.action_id,
        outbox.organization_id,
        outbox.relay_status,
        outbox.payload_ref,
        outbox.attempt_count,
        outbox.next_retry_at,
        outbox.last_error,
        outbox.created_at,
        outbox.processed_at
    `)

  const rows = ("rows" in result ? result.rows : result) as ActionLedgerRelayOutboxSqlRow[]
  return {
    rows: rows.map(actionLedgerRelayOutboxFromSqlRow),
  }
}

export async function markRelayOutboxSucceeded(
  db: AnyDrizzleDb,
  input: MarkActionLedgerRelayOutboxSucceededInput,
): Promise<ActionLedgerRelayOutbox | null> {
  const [row] = await db
    .update(actionLedgerRelayOutbox)
    .set({
      relayStatus: "succeeded",
      nextRetryAt: null,
      lastError: null,
      processedAt: input.processedAt ? parseCursorDate(input.processedAt) : new Date(),
    })
    .where(
      and(
        eq(actionLedgerRelayOutbox.id, input.id),
        eq(actionLedgerRelayOutbox.relayStatus, "processing"),
      ),
    )
    .returning()

  return row ?? null
}

export async function markRelayOutboxFailed(
  db: AnyDrizzleDb,
  input: MarkActionLedgerRelayOutboxFailedInput,
): Promise<ActionLedgerRelayOutbox | null> {
  const deadLetter = input.deadLetter ?? false
  const [row] = await db
    .update(actionLedgerRelayOutbox)
    .set({
      relayStatus: deadLetter ? "dead_letter" : "failed",
      nextRetryAt: deadLetter
        ? null
        : input.nextRetryAt
          ? parseCursorDate(input.nextRetryAt)
          : null,
      lastError: input.lastError,
      processedAt: deadLetter
        ? input.processedAt
          ? parseCursorDate(input.processedAt)
          : new Date()
        : null,
    })
    .where(
      and(
        eq(actionLedgerRelayOutbox.id, input.id),
        eq(actionLedgerRelayOutbox.relayStatus, "processing"),
      ),
    )
    .returning()

  return row ?? null
}

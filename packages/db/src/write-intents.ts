import { newId } from "@voyantjs/schema-kit/typeid"
import { eq, sql } from "drizzle-orm"

import { type WriteIntentRow, writeIntentsTable } from "./schema/infra/write_intents.js"
import type { DrizzleClient } from "./types.js"

// biome-ignore lint/suspicious/noExplicitAny: Drizzle generic inference breaks across client flavors — casts isolated to the query-builder boundary (same pattern as crud.ts/outbox.ts)
type AnyDb = any

/**
 * Enqueue an async write intent, deduped on `idempotencyKey`: a retried
 * request with the same key returns the EXISTING intent (whatever its
 * status), so clients can safely re-POST and re-poll. Returns the row
 * plus whether this call created it — only the creator should emit the
 * `<kind>.requested` event.
 */
export async function enqueueWriteIntent(
  db: DrizzleClient,
  input: { kind: string; payload: unknown; idempotencyKey?: string },
): Promise<{ intent: WriteIntentRow; created: boolean }> {
  const idempotencyKey = input.idempotencyKey ?? newId("write_intents")
  const inserted = (await (db as AnyDb)
    .insert(writeIntentsTable)
    .values({ kind: input.kind, payload: input.payload, idempotencyKey })
    .onConflictDoNothing({ target: writeIntentsTable.idempotencyKey })
    .returning()) as WriteIntentRow[]
  const row = inserted[0]
  if (row) return { intent: row, created: true }

  const existing = (await (db as AnyDb)
    .select()
    .from(writeIntentsTable)
    .where(eq(writeIntentsTable.idempotencyKey, idempotencyKey))
    .limit(1)) as WriteIntentRow[]
  const intent = existing[0]
  if (!intent) {
    throw new Error("write intent insert conflicted but the existing row was not found")
  }
  return { intent, created: false }
}

export async function getWriteIntent(
  db: DrizzleClient,
  id: string,
): Promise<WriteIntentRow | null> {
  const rows = (await (db as AnyDb)
    .select()
    .from(writeIntentsTable)
    .where(eq(writeIntentsTable.id, id))
    .limit(1)) as WriteIntentRow[]
  return rows[0] ?? null
}

/**
 * Settle an intent. Only pending rows transition (handlers are invoked
 * at-least-once by the outbox — a redelivery after success is a no-op).
 * Returns whether this call performed the transition.
 */
export async function settleWriteIntent(
  db: DrizzleClient,
  id: string,
  outcome:
    | { status: "succeeded"; result: unknown }
    | { status: "failed"; result?: unknown; error: string },
): Promise<boolean> {
  const rows = (await (db as AnyDb)
    .update(writeIntentsTable)
    .set({
      status: outcome.status,
      result: outcome.status === "succeeded" ? outcome.result : (outcome.result ?? null),
      error: outcome.status === "failed" ? outcome.error.slice(0, 2000) : null,
      completedAt: new Date(),
    })
    .where(sql`${writeIntentsTable.id} = ${id} AND ${writeIntentsTable.status} = 'pending'`)
    .returning({ id: writeIntentsTable.id })) as Array<{ id: string }>
  return rows.length > 0
}

/**
 * Fail pending intents older than the window — the backstop for intents
 * whose `<kind>.requested` event dead-lettered in the outbox. Run from
 * the same cron as the outbox drain. Returns the failed count.
 */
export async function expireStaleWriteIntents(
  db: DrizzleClient,
  options: { olderThanMinutes?: number } = {},
): Promise<number> {
  const minutes = options.olderThanMinutes ?? 30
  const result = (await (db as AnyDb).execute(sql`
    UPDATE ${writeIntentsTable}
    SET "status" = 'failed',
        "error" = 'intent expired before a handler settled it',
        "completed_at" = now()
    WHERE "status" = 'pending'
      AND "created_at" < now() - (${minutes} * interval '1 minute')
    RETURNING "id"
  `)) as unknown
  const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])
  return rows.length
}

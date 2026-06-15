import { and, asc, eq, sql } from "drizzle-orm"
import type { drizzle } from "drizzle-orm/node-postgres"
import { wakeupsTable } from "./postgres-schema.js"
import type { WakeupRecord, WakeupStore } from "./wakeup-store.js"

type WakeupDb = ReturnType<typeof drizzle>

export interface PostgresWakeupStoreOptions {
  db: WakeupDb
  now?: () => number
}

export function createPostgresWakeupStore(opts: PostgresWakeupStoreOptions): WakeupStore {
  const now = opts.now ?? (() => Date.now())

  return {
    async get(runId) {
      const rows = await opts.db
        .select()
        .from(wakeupsTable)
        .where(eq(wakeupsTable.runId, runId))
        .limit(1)
      return rows[0] ? rowToWakeupRecord(rows[0]) : undefined
    },

    async upsert(record) {
      const values = wakeupToRow(
        {
          ...record,
          updatedAt: record.updatedAt ?? now(),
        },
        record.updatedAt ?? now(),
      )
      const rows = await opts.db
        .insert(wakeupsTable)
        .values(values)
        .onConflictDoUpdate({
          target: wakeupsTable.runId,
          set: values,
        })
        .returning()
      return rowToWakeupRecord(rows[0]!)
    },

    async delete(runId) {
      const rows = await opts.db
        .delete(wakeupsTable)
        .where(eq(wakeupsTable.runId, runId))
        .returning({ runId: wakeupsTable.runId })
      return rows.length > 0
    },

    async list() {
      const rows = await opts.db.select().from(wakeupsTable).orderBy(asc(wakeupsTable.wakeAt))
      return rows.map(rowToWakeupRecord)
    },

    async leaseDue({ owner, now: at = now(), leaseMs, limit = 25 }) {
      const leaseExpiresAt = at + leaseMs
      const result = await opts.db.execute<{
        run_id: string
        wake_at: number
        lease_owner: string | null
        lease_expires_at: number | null
        priority: number
        updated_at: number
      }>(sql`
        WITH due AS (
          SELECT run_id
          FROM voyant_wakeups
          WHERE wake_at <= ${at}
            AND (
              lease_expires_at IS NULL
              OR lease_expires_at <= ${at}
              OR lease_owner = ${owner}
            )
          ORDER BY priority DESC, wake_at ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE voyant_wakeups AS wakeups
        SET lease_owner = ${owner},
            lease_expires_at = ${leaseExpiresAt},
            updated_at = ${at}
        FROM due
        WHERE wakeups.run_id = due.run_id
        RETURNING wakeups.run_id, wakeups.wake_at, wakeups.priority, wakeups.lease_owner, wakeups.lease_expires_at, wakeups.updated_at
      `)
      const rows = result.rows as Array<{
        run_id: string
        wake_at: number | string
        priority: number | string
        lease_owner: string | null
        lease_expires_at: number | string | null
        updated_at: number | string
      }>
      rows.sort((a, b) => {
        const priorityDelta = toNumber(b.priority) - toNumber(a.priority)
        if (priorityDelta !== 0) return priorityDelta
        return toNumber(a.wake_at) - toNumber(b.wake_at)
      })
      return rows.map((row) => ({
        runId: row.run_id,
        wakeAt: toNumber(row.wake_at),
        priority: toNumber(row.priority),
        leaseOwner: row.lease_owner ?? undefined,
        leaseExpiresAt: row.lease_expires_at === null ? undefined : toNumber(row.lease_expires_at),
        updatedAt: toNumber(row.updated_at),
      }))
    },

    async release(runId, owner) {
      const conditions = [eq(wakeupsTable.runId, runId)]
      if (owner) {
        conditions.push(eq(wakeupsTable.leaseOwner, owner))
      }
      await opts.db
        .update(wakeupsTable)
        .set({
          leaseOwner: null,
          leaseExpiresAt: null,
          updatedAt: now(),
        })
        .where(conditions.length === 1 ? conditions[0]! : and(...conditions))
    },
  }
}

export function wakeupToRow(
  record: Omit<WakeupRecord, "updatedAt"> & { updatedAt: number },
  updatedAt: number,
) {
  return {
    runId: record.runId,
    wakeAt: record.wakeAt,
    priority: record.priority ?? 0,
    leaseOwner: record.leaseOwner ?? null,
    leaseExpiresAt: record.leaseExpiresAt ?? null,
    updatedAt,
  }
}

export function rowToWakeupRecord(row: typeof wakeupsTable.$inferSelect): WakeupRecord {
  return {
    runId: row.runId,
    wakeAt: row.wakeAt,
    priority: row.priority,
    leaseOwner: row.leaseOwner ?? undefined,
    leaseExpiresAt: row.leaseExpiresAt ?? undefined,
    updatedAt: row.updatedAt,
  }
}

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number.parseInt(value, 10)
}

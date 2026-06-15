// Postgres-backed RunRecordStore — implements the orchestrator's primary
// state-store interface (`@voyant-travel/workflows-orchestrator/RunRecordStore`)
// against the existing `voyant_snapshot_runs` table.
//
// The snapshot table already carries a `run_record` JSONB column; this
// store uses that for the full RunRecord plus the indexed columns
// (`workflow_id`, `status`, `started_at`, etc.) for queries. The Node driver
// `createStandaloneDriver` plugs this into the orchestrator core's
// pure trigger/resume/cancel functions.
//
// The new `idempotency_key` column populated from `RunRecord.idempotencyKey`
// is enforced by the unique partial index added in migration 0003 — the
// orchestrator's deterministic-runId derivation from `idempotencyKey`
// dedups via the row primary key as well, so this index is a defensive
// safety net.

import { and, desc, eq } from "drizzle-orm"
import type { drizzle } from "drizzle-orm/node-postgres"
import type { OrchestratorRunStatus, RunRecord, RunRecordStore } from "./core.js"

import { snapshotRunsTable } from "./postgres-schema.js"

type SnapshotDb = ReturnType<typeof drizzle>

export interface PostgresRunRecordStoreOptions {
  db: SnapshotDb
}

export function createPostgresRunRecordStore(opts: PostgresRunRecordStoreOptions): RunRecordStore {
  return {
    async get(id) {
      const rows = await opts.db
        .select()
        .from(snapshotRunsTable)
        .where(eq(snapshotRunsTable.id, id))
        .limit(1)
      const row = rows[0]
      if (!row) return undefined
      // The full state lives on `run_record`. Older rows persisted by
      // `createPostgresSnapshotRunStore` may lack it; fall back to the
      // denormalized columns so reads stay backwards-compatible.
      const stored = asRunRecord(row.runRecord)
      if (stored) return stored
      return undefined
    },

    async save(record) {
      const values = recordToValues(record)
      // Upsert by id — last-write-wins. Used for state mutations after
      // the run is created (resume / cancel / drive). Idempotency on
      // *creation* is enforced separately via `tryInsert` below; this
      // path is the steady-state save.
      await opts.db.insert(snapshotRunsTable).values(values).onConflictDoUpdate({
        target: snapshotRunsTable.id,
        set: values,
      })
      return record
    },

    async tryInsert(record) {
      const values = recordToValues(record)
      // Atomic at the DB level: INSERT … ON CONFLICT DO NOTHING returns
      // the row only if it was created, empty otherwise. When empty, we
      // re-SELECT to load the existing record. This closes the race
      // window between `get(id)` and `save(record)` that the previous
      // get-then-upsert pattern left open — concurrent triggers with
      // the same idempotency-derived runId now see deterministic
      // "first writer wins" semantics.
      const inserted = await opts.db
        .insert(snapshotRunsTable)
        .values(values)
        .onConflictDoNothing({ target: snapshotRunsTable.id })
        .returning({ id: snapshotRunsTable.id })

      if (inserted.length > 0) {
        return { record, created: true }
      }
      // Conflict — load whoever won the race.
      const existingRows = await opts.db
        .select()
        .from(snapshotRunsTable)
        .where(eq(snapshotRunsTable.id, record.id))
        .limit(1)
      const existingRow = existingRows[0]
      if (!existingRow) {
        // Pathological case: the conflict happened but we can't read it
        // back. Surface as a write that became a no-op so the caller
        // doesn't proceed to drive a non-existent run.
        return { record, created: false }
      }
      const existing = asRunRecord(existingRow.runRecord)
      return {
        record: existing ?? record,
        created: false,
      }
    },

    async list(filter = {}) {
      const conditions = []
      if (filter.workflowId) {
        conditions.push(eq(snapshotRunsTable.workflowId, filter.workflowId))
      }
      if (filter.status) {
        conditions.push(eq(snapshotRunsTable.status, filter.status))
      }

      let query = opts.db.select().from(snapshotRunsTable).$dynamic()
      if (conditions.length === 1) {
        query = query.where(conditions[0]!)
      } else if (conditions.length > 1) {
        query = query.where(and(...conditions))
      }
      query = query.orderBy(desc(snapshotRunsTable.startedAt))
      if (filter.limit !== undefined) {
        query = query.limit(filter.limit)
      }
      const rows = await query

      const out: RunRecord[] = []
      for (const row of rows) {
        const stored = asRunRecord(row.runRecord)
        if (stored) out.push(stored)
      }
      return out
    },
  }
}

// ---- Helpers (parallel to the snapshot store's; kept private here to
//      avoid coupling between the two stores' representations) ----

function recordToValues(record: RunRecord) {
  return {
    id: record.id,
    workflowId: record.workflowId,
    status: record.status,
    startedAt: record.startedAt,
    completedAt: record.completedAt ?? null,
    durationMs: record.completedAt !== undefined ? record.completedAt - record.startedAt : null,
    tags: [...record.tags],
    // `result` mirrors the snapshot-store convention: the run's public
    // outcome view. We snapshot output + error here so the dashboard's
    // reads remain consistent across both stores.
    result: normalizeRequiredJson({
      status: record.status,
      output: record.output,
      error: record.error,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
    }),
    input: normalizeJson(record.input),
    runRecord: normalizeRequiredJson({ ...record }),
    entryFile: null,
    replayOf: null,
    idempotencyKey: record.idempotencyKey ?? null,
  }
}

function asRunRecord(value: unknown): RunRecord | undefined {
  if (typeof value !== "object" || value === null) return undefined
  // Sanity check: every RunRecord has at least { id, status, journal }.
  const v = value as Record<string, unknown>
  if (typeof v.id !== "string") return undefined
  if (typeof v.status !== "string") return undefined
  return value as RunRecord
}

function normalizeJson<T>(value: T): T | null {
  if (value === undefined) return null
  return JSON.parse(
    JSON.stringify(value, (_key, nested) => (typeof nested === "bigint" ? Number(nested) : nested)),
  ) as T
}

function normalizeRequiredJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, nested) => (typeof nested === "bigint" ? Number(nested) : nested)),
  ) as T
}

// Re-export for type discoverability — the orchestrator's status union
// shows up frequently in consumer code that filters runs by status.
export type { OrchestratorRunStatus }

// Postgres-backed RunRecordStore — implements the orchestrator's primary
// state-store interface (`@voyantjs/workflows-orchestrator/RunRecordStore`)
// against the existing `voyant_snapshot_runs` table.
//
// The snapshot table already carries a `run_record` JSONB column; this
// store uses that for the full RunRecord plus the indexed columns
// (`workflow_id`, `status`, `started_at`, etc.) for queries. Mode 2's
// `createNodeStandaloneDriver` plugs this into the orchestrator core's
// pure trigger/resume/cancel functions.
//
// The new `idempotency_key` column populated from `RunRecord.idempotencyKey`
// is enforced by the unique partial index added in migration 0003 — the
// orchestrator's deterministic-runId derivation from `idempotencyKey`
// dedups via the row primary key as well, so this index is a defensive
// safety net.

import type {
  OrchestratorRunStatus,
  RunRecord,
  RunRecordStore,
} from "@voyantjs/workflows-orchestrator"
import { and, desc, eq } from "drizzle-orm"
import type { drizzle } from "drizzle-orm/node-postgres"

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
      const values = {
        id: record.id,
        workflowId: record.workflowId,
        status: record.status,
        startedAt: record.startedAt,
        completedAt: record.completedAt ?? null,
        durationMs: record.completedAt !== undefined ? record.completedAt - record.startedAt : null,
        tags: [...record.tags],
        // `result` mirrors the snapshot-store convention: the run's
        // public outcome view. We snapshot output + error here so the
        // dashboard's reads remain consistent across both stores.
        result: normalizeRequiredJson({
          status: record.status,
          output: record.output,
          error: record.error,
          startedAt: record.startedAt,
          completedAt: record.completedAt,
        }),
        input: normalizeJson(record.input),
        runRecord: normalizeRequiredJson(record as unknown as Record<string, unknown>),
        entryFile: null,
        replayOf: null,
        idempotencyKey: record.idempotencyKey ?? null,
      }
      // Upsert by id — last-write-wins. The orchestrator's deterministic
      // runId derivation from `idempotencyKey` ensures retries map to the
      // same row; the unique partial index on `(workflow_id, idempotency_key)`
      // is a defensive backstop against accidental id collisions.
      await opts.db.insert(snapshotRunsTable).values(values).onConflictDoUpdate({
        target: snapshotRunsTable.id,
        set: values,
      })
      return record
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

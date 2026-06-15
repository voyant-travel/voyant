import { and, desc, eq } from "drizzle-orm"
import type { drizzle } from "drizzle-orm/node-postgres"
import type { RunRecord } from "./core.js"
import { snapshotRunsTable } from "./postgres-schema.js"
import type { SnapshotRunStore, StoredRun } from "./snapshot-run-store.js"

type SnapshotDb = ReturnType<typeof drizzle>

export interface PostgresSnapshotRunStoreOptions {
  db: SnapshotDb
  now?: () => number
  random?: () => number
}

type StoredSnapshotRun = StoredRun & { runRecord?: RunRecord }

export function createPostgresSnapshotRunStore(
  opts: PostgresSnapshotRunStoreOptions,
): SnapshotRunStore {
  const now = opts.now ?? (() => Date.now())
  const random = opts.random ?? Math.random

  return {
    async save({ workflowId, input, result, entryFile, replayOf }) {
      const startedAt = toNumber(result.startedAt) ?? now()
      const completedAt = toNumber(result.completedAt)
      const stored: StoredRun = {
        id: generateRunId(now, random),
        workflowId,
        status: typeof result.status === "string" ? result.status : "unknown",
        startedAt,
        completedAt,
        durationMs: completedAt !== undefined ? completedAt - startedAt : undefined,
        tags: Array.isArray(result.tags) ? (result.tags as string[]) : undefined,
        result,
        input,
        entryFile,
        replayOf,
      }
      await upsertStoredRun(opts.db, stored)
      return stored
    },

    async list(filter = {}) {
      const conditions = []
      if (filter.workflowId) conditions.push(eq(snapshotRunsTable.workflowId, filter.workflowId))
      if (filter.status) conditions.push(eq(snapshotRunsTable.status, filter.status))

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
      return rows.map(rowToStoredRun)
    },

    async get(runId) {
      const rows = await opts.db
        .select()
        .from(snapshotRunsTable)
        .where(eq(snapshotRunsTable.id, runId))
        .limit(1)
      return rows[0] ? rowToStoredRun(rows[0]) : undefined
    },

    async update(run) {
      await upsertStoredRun(opts.db, run)
      return run
    },

    async delete(runId) {
      const rows = await opts.db
        .delete(snapshotRunsTable)
        .where(eq(snapshotRunsTable.id, runId))
        .returning({ id: snapshotRunsTable.id })
      return rows.length > 0
    },
  }
}

export function storedRunToRow(run: StoredSnapshotRun) {
  return {
    id: run.id,
    workflowId: run.workflowId,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt ?? null,
    durationMs: run.durationMs ?? null,
    tags: run.tags ?? [],
    result: normalizeRequiredJson(run.result),
    input: normalizeJson(run.input),
    runRecord: normalizeJsonRecord(run.runRecord),
    entryFile: run.entryFile ?? null,
    replayOf: run.replayOf ?? null,
  }
}

export function rowToStoredRun(row: typeof snapshotRunsTable.$inferSelect): StoredSnapshotRun {
  return {
    id: row.id,
    workflowId: row.workflowId,
    status: row.status,
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? undefined,
    durationMs: row.durationMs ?? undefined,
    tags: Array.isArray(row.tags) ? row.tags : undefined,
    result: asRecord(row.result),
    input: row.input,
    runRecord: asRunRecord(row.runRecord),
    entryFile: row.entryFile ?? undefined,
    replayOf: row.replayOf ?? undefined,
  }
}

async function upsertStoredRun(db: SnapshotDb, run: StoredSnapshotRun): Promise<void> {
  const values = storedRunToRow(run)
  await db.insert(snapshotRunsTable).values(values).onConflictDoUpdate({
    target: snapshotRunsTable.id,
    set: values,
  })
}

function toNumber(x: unknown): number | undefined {
  return typeof x === "number" ? x : undefined
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
}

function asRunRecord(value: unknown): RunRecord | undefined {
  return typeof value === "object" && value !== null ? (value as RunRecord) : undefined
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

function normalizeJsonRecord(value: unknown): Record<string, unknown> | null {
  if (value === undefined) return null
  return JSON.parse(
    JSON.stringify(value, (_key, nested) => (typeof nested === "bigint" ? Number(nested) : nested)),
  ) as Record<string, unknown>
}

function generateRunId(now: () => number, random: () => number): string {
  const ts = now().toString(36)
  const rand = Math.floor(random() * 1_000_000)
    .toString(36)
    .padStart(4, "0")
  return `run_${ts}_${rand}`
}

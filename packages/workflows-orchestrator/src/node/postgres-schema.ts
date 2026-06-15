import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const snapshotRunsTable = pgTable(
  "voyant_snapshot_runs",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id").notNull(),
    status: text("status").notNull(),
    startedAt: bigint("started_at", { mode: "number" }).notNull(),
    completedAt: bigint("completed_at", { mode: "number" }),
    durationMs: integer("duration_ms"),
    tags: jsonb("tags").$type<string[]>().notNull(),
    result: jsonb("result").$type<Record<string, unknown>>().notNull(),
    input: jsonb("input").$type<unknown>(),
    runRecord: jsonb("run_record").$type<Record<string, unknown>>(),
    entryFile: text("entry_file"),
    replayOf: text("replay_of"),
    /**
     * Caller-supplied idempotency token, mirrored from
     * `RunRecord.idempotencyKey` / `TriggerArgs.idempotencyKey`.
     * The unique partial index below enforces dedup on
     * `(workflow_id, idempotency_key)`; null values don't participate.
     */
    idempotencyKey: text("idempotency_key"),
  },
  (table) => ({
    workflowStartedIdx: index("voyant_snapshot_runs_workflow_started_idx").on(
      table.workflowId,
      table.startedAt,
    ),
    statusStartedIdx: index("voyant_snapshot_runs_status_started_idx").on(
      table.status,
      table.startedAt,
    ),
    /**
     * Unique partial index — enforces idempotency dedup on
     * `(workflow_id, idempotency_key)` while letting null keys coexist.
     * Read in `createPostgresSnapshotRunStore` via `INSERT … ON CONFLICT
     * DO NOTHING RETURNING id`.
     */
    idempotencyIdx: uniqueIndex("voyant_snapshot_runs_idempotency_idx")
      .on(table.workflowId, table.idempotencyKey)
      // agent-quality: raw-sql reviewed -- owner: workflows-orchestrator; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
  }),
)

export const wakeupsTable = pgTable(
  "voyant_wakeups",
  {
    runId: text("run_id").primaryKey(),
    wakeAt: bigint("wake_at", { mode: "number" }).notNull(),
    priority: integer("priority").notNull().default(0),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: bigint("lease_expires_at", { mode: "number" }),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    dueIdx: index("voyant_wakeups_due_idx").on(table.priority.desc(), table.wakeAt.asc()),
    leaseIdx: index("voyant_wakeups_lease_idx").on(table.leaseExpiresAt),
  }),
)

/**
 * Manifest store. Holds workflow + event-filter manifests pushed at
 * `createApp()` boot via `driver.registerManifest(...)`. Last N versions
 * retained per environment; `is_current` points to the active version.
 *
 * One row is "current" per environment, enforced by the partial unique
 * index `voyant_workflow_manifests_current_idx`.
 *
 * See architecture doc §14 for the manifest lifecycle.
 */
export const workflowManifestsTable = pgTable(
  "voyant_workflow_manifests",
  {
    environment: text("environment").notNull(),
    versionId: text("version_id").notNull(),
    manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull(),
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
    isCurrent: boolean("is_current").notNull().default(false),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.environment, table.versionId] }),
    currentIdx: uniqueIndex("voyant_workflow_manifests_current_idx")
      .on(table.environment)
      // agent-quality: raw-sql reviewed -- owner: workflows-orchestrator; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .where(sql`${table.isCurrent}`),
  }),
)

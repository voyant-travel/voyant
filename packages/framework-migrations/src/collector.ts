/**
 * Multi-source migration collector (consolidated-deployments RFC, Workstream
 * D.1). Applies migrations from ordered sources — the framework-shipped bundle
 * first, then the deployment's own migrations — recording each in a single
 * version-independent ledger keyed by `(source, tag, content_hash)`.
 *
 * Properties (validated in `spikes/d1-migration-collector` + the integration
 * tests): framework-first ordering, idempotent re-runs, an upgrade applies only
 * the new migrations, and a shipped migration is immutable once applied (a
 * content-hash change is a hard error). See `docs/architecture/migration-collector-d1.md`.
 */

import { createHash } from "node:crypto"

/** One migration: a tag unique within its source + raw SQL. */
export interface MigrationStatement {
  /** Unique-within-source tag, e.g. `0001_init`. */
  tag: string
  /** Raw SQL; drizzle `--> statement-breakpoint` separators are honored. */
  sql: string
}

/** An ordered migration source (e.g. the framework bundle, or the deployment). */
export interface MigrationSource {
  /** Name recorded in the ledger, e.g. `framework` / `deployment`. */
  name: string
  /**
   * Apply order across sources within a run (lower first). Framework < deployment
   * is load-bearing — deployment link tables FK into framework tables.
   */
  priority: number
  /** Migrations in their in-source apply order. */
  migrations: MigrationStatement[]
}

export interface PlannedMigration {
  source: string
  tag: string
  sql: string
  /** sha256 of the raw SQL (immutability key). */
  contentHash: string
}

/** Minimal pg-compatible client (keeps this package free of a `pg` dependency). */
export interface MigrationClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>
}

export interface ApplyMigrationsOptions {
  /** Ledger schema (default `drizzle`). */
  ledgerSchema?: string
  /** Ledger table (default `_voyant_migrations`). */
  ledgerTable?: string
  /** Called with `"{source}/{tag}"` after each migration is applied. */
  onApplied?: (id: string) => void
}

/** Thrown when an already-applied `(source, tag)` arrives with changed SQL. */
export class MigrationImmutabilityError extends Error {
  constructor(
    readonly source: string,
    readonly tag: string,
    readonly ledgerHash: string,
    readonly currentHash: string,
  ) {
    super(
      `migration immutability violation: ${source}/${tag} changed after it was applied ` +
        `(ledger ${ledgerHash.slice(0, 12)}… != current ${currentHash.slice(0, 12)}…). ` +
        "Shipped migrations are immutable — add a new migration instead of editing an applied one.",
    )
    this.name = "MigrationImmutabilityError"
  }
}

const contentHash = (sql: string) => createHash("sha256").update(sql).digest("hex")

/** Split a drizzle migration's SQL into individual statements. */
function splitStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Deterministic apply order across sources: `(source.priority, in-source index)`.
 * Mutating a source's `migrations` order is significant — keep them append-only.
 */
export function planMigrations(sources: MigrationSource[]): PlannedMigration[] {
  return sources
    .flatMap((source) =>
      source.migrations.map((m, seq) => ({
        source: source.name,
        priority: source.priority,
        seq,
        tag: m.tag,
        sql: m.sql,
        contentHash: contentHash(m.sql),
      })),
    )
    .sort((a, b) => a.priority - b.priority || a.seq - b.seq)
    .map(({ source, tag, sql, contentHash: hash }) => ({ source, tag, sql, contentHash: hash }))
}

function qualifiedLedger(options?: ApplyMigrationsOptions): string {
  const schema = options?.ledgerSchema ?? "drizzle"
  const table = options?.ledgerTable ?? "_voyant_migrations"
  return `"${schema}"."${table}"`
}

/** Create the ledger schema + table if absent. Shared by apply + baseline. */
async function ensureLedger(
  client: MigrationClient,
  options?: ApplyMigrationsOptions,
): Promise<string> {
  const ledger = qualifiedLedger(options)
  const schema = options?.ledgerSchema ?? "drizzle"
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`)
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${ledger} (
       "source" text NOT NULL,
       "tag" text NOT NULL,
       "content_hash" text NOT NULL,
       "applied_at" timestamptz NOT NULL DEFAULT now(),
       PRIMARY KEY ("source", "tag")
     )`,
  )
  return ledger
}

/**
 * Baseline an EXISTING deployment onto the collector ledger: record every
 * planned migration as already-applied **without executing its SQL** — for a DB
 * whose schema already matches `sources` (materialised by the legacy runner +
 * `drizzle-kit push`). Idempotent (`ON CONFLICT DO NOTHING`); the caller MUST
 * have verified schema parity first, since this asserts "the schema is already
 * here" without checking. Returns the `"{source}/{tag}"` ids newly recorded.
 *
 * See the cutover section of docs/architecture/migration-collector-d1.md.
 */
export async function importBaseline(
  client: MigrationClient,
  sources: MigrationSource[],
  options?: ApplyMigrationsOptions,
): Promise<string[]> {
  const ledger = await ensureLedger(client, options)
  const imported: string[] = []
  for (const m of planMigrations(sources)) {
    const res = await client.query(
      `INSERT INTO ${ledger} ("source", "tag", "content_hash") VALUES ($1, $2, $3)
       ON CONFLICT ("source", "tag") DO NOTHING`,
      [m.source, m.tag, m.contentHash],
    )
    // node-postgres exposes rowCount; treat absent (0/undefined) as "already there".
    const inserted = (res as { rowCount?: number }).rowCount ?? 0
    if (inserted > 0) {
      const id = `${m.source}/${m.tag}`
      imported.push(id)
      options?.onApplied?.(id)
    }
  }
  return imported
}

/**
 * Apply every pending migration across `sources` in plan order, recording each
 * in the ledger. Idempotent (already-applied identical migrations are skipped);
 * throws {@link MigrationImmutabilityError} if an applied migration's SQL
 * changed. Each migration + its ledger row commit atomically. Returns the list
 * of `"{source}/{tag}"` applied this run, in apply order.
 */
export async function applyMigrations(
  client: MigrationClient,
  sources: MigrationSource[],
  options?: ApplyMigrationsOptions,
): Promise<string[]> {
  const ledger = await ensureLedger(client, options)

  const applied: string[] = []
  for (const m of planMigrations(sources)) {
    const seen = await client.query(
      `SELECT "content_hash" FROM ${ledger} WHERE "source" = $1 AND "tag" = $2`,
      [m.source, m.tag],
    )
    if (seen.rows.length > 0) {
      const ledgerHash = String(seen.rows[0]?.content_hash ?? "")
      if (ledgerHash !== m.contentHash) {
        throw new MigrationImmutabilityError(m.source, m.tag, ledgerHash, m.contentHash)
      }
      continue // already applied, identical → no-op
    }

    await client.query("BEGIN")
    try {
      for (const statement of splitStatements(m.sql)) {
        await client.query(statement)
      }
      await client.query(
        `INSERT INTO ${ledger} ("source", "tag", "content_hash") VALUES ($1, $2, $3)`,
        [m.source, m.tag, m.contentHash],
      )
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }

    const id = `${m.source}/${m.tag}`
    applied.push(id)
    options?.onApplied?.(id)
  }

  return applied
}

export interface ApplyD2MigrationsOptions extends ApplyMigrationsOptions {
  /**
   * Per-source set of migration tags the retired framework bundle already
   * materialised (the cutline). On an `existing` database these are recorded as
   * applied WITHOUT executing their SQL (the tables already exist).
   */
  cutline: Record<string, readonly string[]>
  /**
   * True for an existing pre-D.2 database whose cutline schema is already
   * materialised (the caller MUST verify parity first). False for a fresh
   * database, where every migration executes.
   */
  existing: boolean
  /** Called with `"{source}/{tag}"` after a cutline migration is import-baselined. */
  onBaselined?: (id: string) => void
}

/**
 * The D.2 dual-path collector. Applies per-package + deployment `sources` in plan
 * order against the ledger:
 *   • a migration already in the ledger (identical hash) is skipped; a changed
 *     hash is a {@link MigrationImmutabilityError};
 *   • on an `existing` database, a not-yet-recorded migration whose (source, tag)
 *     is in the `cutline` is IMPORT-BASELINED (recorded, SQL NOT run — the bundle
 *     already materialised it). The caller must have verified schema parity first;
 *   • everything else EXECUTES (a fresh database, or a post-cutline increment).
 * The retired framework bundle is NOT a source here — any `framework/*` ledger
 * rows are left untouched as inert history. Returns the ids executed and
 * import-baselined this run.
 */
export async function applyD2Migrations(
  client: MigrationClient,
  sources: MigrationSource[],
  options: ApplyD2MigrationsOptions,
): Promise<{ executed: string[]; baselined: string[] }> {
  const ledger = await ensureLedger(client, options)
  const covered = new Map<string, Set<string>>()
  for (const [source, tags] of Object.entries(options.cutline)) {
    covered.set(source, new Set(tags))
  }

  const executed: string[] = []
  const baselined: string[] = []
  for (const m of planMigrations(sources)) {
    const seen = await client.query(
      `SELECT "content_hash" FROM ${ledger} WHERE "source" = $1 AND "tag" = $2`,
      [m.source, m.tag],
    )
    if (seen.rows.length > 0) {
      const ledgerHash = String(seen.rows[0]?.content_hash ?? "")
      if (ledgerHash !== m.contentHash) {
        throw new MigrationImmutabilityError(m.source, m.tag, ledgerHash, m.contentHash)
      }
      continue // already applied, identical → no-op
    }

    const id = `${m.source}/${m.tag}`

    if (options.existing && covered.get(m.source)?.has(m.tag)) {
      // Bundle-covered on an existing DB → record without executing.
      await client.query(
        `INSERT INTO ${ledger} ("source", "tag", "content_hash") VALUES ($1, $2, $3)
         ON CONFLICT ("source", "tag") DO NOTHING`,
        [m.source, m.tag, m.contentHash],
      )
      baselined.push(id)
      options.onBaselined?.(id)
      continue
    }

    // Fresh DB, or a post-cutline increment → execute (migration + ledger row
    // commit atomically).
    await client.query("BEGIN")
    try {
      for (const statement of splitStatements(m.sql)) {
        await client.query(statement)
      }
      await client.query(
        `INSERT INTO ${ledger} ("source", "tag", "content_hash") VALUES ($1, $2, $3)`,
        [m.source, m.tag, m.contentHash],
      )
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }
    executed.push(id)
    options.onApplied?.(id)
  }

  return { executed, baselined }
}

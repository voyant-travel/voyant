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

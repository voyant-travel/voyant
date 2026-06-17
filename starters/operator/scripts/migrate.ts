/**
 * Deployment migration runner — cut over to the D.1 multi-source collector
 * (`@voyant-travel/framework-migrations`). Applies, in order:
 *
 *   1. the framework bundle  (@voyant-travel/framework-migrations `migrations/`)
 *   2. this deployment's links (./migrations-d1 — cross-module pivot tables)
 *
 * recording each in the `drizzle._voyant_migrations` ledger keyed by
 * `(source, tag, content_hash)`. Three modes, auto-detected:
 *
 *   • FRESH      — empty DB → execute bundle + links.
 *   • BASELINE   — existing legacy deployment (has `drizzle.__drizzle_migrations`
 *                  but no collector ledger): its schema is already materialised
 *                  by the old runner + `drizzle-kit push`, so we IMPORT the
 *                  bundle + links into the ledger WITHOUT re-executing — gated by
 *                  a schema-parity check (every bundle/link table must already
 *                  exist; otherwise the DB isn't at the current schema and we
 *                  refuse rather than record a false baseline).
 *   • INCREMENTAL — already on the collector → apply only new migrations.
 *
 * The legacy single-folder history (`./migrations`) is RETIRED by this cutover:
 * it is incomplete (16 live tables — operations/ground + quote versioning — have
 * no CREATE migration) and stale (~40 retired-table CREATEs), so it is not a
 * valid replay source. See docs/architecture/migration-collector-d1.md.
 */
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  applyMigrations,
  importBaseline,
  loadFrameworkBundleSource,
  loadMigrationFolder,
  type MigrationSource,
  planMigrations,
} from "@voyant-travel/framework-migrations"
import { config } from "dotenv"
import { Client } from "pg"

config({ path: ".env" })
config({ path: "../../.env" })
config({ path: "../../.env.local" })
config({ path: ".dev.vars", override: true })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set")
}

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const linksFolder = path.resolve(scriptsDir, "../migrations-d1")

const client = new Client({ connectionString: databaseUrl })

/** Row count of a ledger table, or 0 if the table doesn't exist. */
async function ledgerRowCount(qualified: string): Promise<number> {
  const exists = await client.query<{ reg: string | null }>(`SELECT to_regclass($1) AS reg`, [
    qualified,
  ])
  if (!exists.rows[0]?.reg) {
    return 0
  }
  const count = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${qualified}`)
  return Number(count.rows[0]?.n ?? 0)
}

/** Table names a set of sources expects to exist (parsed from their CREATE TABLEs). */
function expectedTables(sources: MigrationSource[]): Set<string> {
  const tables = new Set<string>()
  const re = /CREATE TABLE (?:IF NOT EXISTS )?"([a-z0-9_]+)"/gi
  for (const m of planMigrations(sources)) {
    for (const match of m.sql.matchAll(re)) {
      tables.add(match[1] as string)
    }
  }
  return tables
}

/** Guard a baseline-import: every expected table must already exist in `public`. */
async function assertSchemaAtBaseline(sources: MigrationSource[]): Promise<void> {
  const expected = expectedTables(sources)
  const live = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  )
  const liveSet = new Set(live.rows.map((r) => r.table_name))
  const missing = [...expected].filter((t) => !liveSet.has(t)).sort()
  if (missing.length > 0) {
    throw new Error(
      `cannot baseline onto the collector — this database is NOT at the current schema.\n` +
        `  ${missing.length} expected table(s) are missing, e.g.: ${missing.slice(0, 8).join(", ")}${
          missing.length > 8 ? ", …" : ""
        }\n` +
        `  Converge first (the live aggregate schema is materialised via 'pnpm db:push'/drizzle-kit\n` +
        `  push for tables with no legacy CREATE migration), then re-run this migration to baseline.`,
    )
  }
}

try {
  await client.connect()

  const bundle = await loadFrameworkBundleSource()
  const links: MigrationSource = {
    name: "deployment",
    priority: 1,
    migrations: await loadMigrationFolder(linksFolder),
  }
  const sources = [bundle, links]

  const onCollector = await ledgerRowCount(`"drizzle"."_voyant_migrations"`)
  const onLegacy = await ledgerRowCount(`"drizzle"."__drizzle_migrations"`)

  let applied: string[]
  if (onCollector === 0 && onLegacy > 0) {
    // Existing legacy deployment — its schema is already materialised; record
    // the bundle + links as applied without re-executing (gated by parity).
    console.log("Existing legacy deployment detected — baselining onto the collector ledger.")
    await assertSchemaAtBaseline(sources)
    applied = await importBaseline(client, sources, {
      onApplied: (id) => console.log(`▷ baselined ${id}`),
    })
  } else {
    // Fresh DB (execute) or already on the collector (apply only new).
    applied = await applyMigrations(client, sources, {
      onApplied: (id) => console.log(`✓ applied ${id}`),
    })
  }

  if (applied.length === 0) {
    console.log("No pending migrations.")
  } else {
    // Postgres-js (and most drivers) cache prepared-statement plans per
    // connection. Long-lived workers / dev servers that started before this
    // run will have stale plans referencing the old schema and will fail on
    // the first query that touches a changed column. Tell the caller so
    // their deploy pipeline (or the dev) can restart the right thing.
    console.log("")
    console.log(`Recorded ${applied.length} migration(s).`)
    console.log("⚠️  Restart any long-lived workers / dev servers now —")
    console.log("    drizzle's prepared-statement cache is keyed to the old schema.")
  }
} finally {
  await client.end()
}

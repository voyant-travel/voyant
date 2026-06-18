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
 *                  a schema-parity check over the FINAL net schema (every net
 *                  table present, every ALTER-added column present, every dropped
 *                  table gone); otherwise the DB isn't at the current schema and
 *                  we refuse rather than record a false baseline.
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

/**
 * The schema the bundle+links would produce, reduced to what we can verify
 * against a live DB without executing anything: the NET set of tables (created
 * minus later-dropped), the tables the plan DROPS (which must be gone in a
 * converged DB), and every column added via `ALTER TABLE … ADD COLUMN`.
 *
 * Parsing the whole plan in order is what makes this a real parity check: a
 * CREATE-name-only scan misses `custom_fields` columns added by ALTER (0001-3)
 * and never subtracts `custom_field_values` dropped by 0004 — so it could both
 * falsely baseline a DB missing those columns and falsely reject a correctly
 * converged DB that no longer has the dropped table.
 */
interface ExpectedSchema {
  /** Tables that must EXIST at baseline (created and not subsequently dropped). */
  tables: Set<string>
  /** Tables the plan drops — must be ABSENT in a converged DB. */
  dropped: Set<string>
  /** Columns added via ALTER — must exist on their (net) table. `table.column`. */
  columns: Set<string>
}

function expectedSchema(sources: MigrationSource[]): ExpectedSchema {
  const tables = new Set<string>()
  const dropped = new Set<string>()
  const addedColumns: { table: string; column: string }[] = []
  // One ordered scan over the plan: CREATE adds a table, DROP removes it (and
  // records it as must-be-absent), ALTER … ADD COLUMN records an expected column.
  const stmt =
    /CREATE TABLE (?:IF NOT EXISTS )?"([a-z0-9_]+)"|DROP TABLE (?:IF EXISTS )?"([a-z0-9_]+)"|ALTER TABLE "([a-z0-9_]+)" ADD COLUMN (?:IF NOT EXISTS )?"([a-z0-9_]+)"/gi
  for (const m of planMigrations(sources)) {
    for (const match of m.sql.matchAll(stmt)) {
      const [, created, droppedName, alterTable, alterColumn] = match
      if (created) {
        tables.add(created)
        dropped.delete(created)
      } else if (droppedName) {
        tables.delete(droppedName)
        dropped.add(droppedName)
      } else if (alterTable && alterColumn) {
        addedColumns.push({ table: alterTable, column: alterColumn })
      }
    }
  }
  // Only require columns on tables that still exist in the net schema.
  const columns = new Set(
    addedColumns.filter((c) => tables.has(c.table)).map((c) => `${c.table}.${c.column}`),
  )
  return { tables, dropped, columns }
}

/**
 * Guard a baseline-import: the live DB must already match the schema the plan
 * would produce — every net table present, every added column present, and
 * every dropped table gone. Otherwise we refuse rather than record a false
 * baseline (which would skip real migrations forever).
 */
async function assertSchemaAtBaseline(sources: MigrationSource[]): Promise<void> {
  const expected = expectedSchema(sources)

  const liveTablesRows = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  )
  const liveTables = new Set(liveTablesRows.rows.map((r) => r.table_name))
  const liveColsRows = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
  )
  const liveColumns = new Set(liveColsRows.rows.map((r) => `${r.table_name}.${r.column_name}`))

  const missingTables = [...expected.tables].filter((t) => !liveTables.has(t)).sort()
  const missingColumns = [...expected.columns].filter((c) => !liveColumns.has(c)).sort()
  const lingeringDropped = [...expected.dropped].filter((t) => liveTables.has(t)).sort()

  const problems: string[] = []
  const sample = (xs: string[]) => `${xs.slice(0, 8).join(", ")}${xs.length > 8 ? ", …" : ""}`
  if (missingTables.length > 0) {
    problems.push(`${missingTables.length} expected table(s) missing: ${sample(missingTables)}`)
  }
  if (missingColumns.length > 0) {
    problems.push(`${missingColumns.length} expected column(s) missing: ${sample(missingColumns)}`)
  }
  if (lingeringDropped.length > 0) {
    problems.push(
      `${lingeringDropped.length} table(s) the plan drops still present: ${sample(lingeringDropped)} ` +
        `(run the relevant backfill/cleanup so the DB matches the final schema)`,
    )
  }
  if (problems.length > 0) {
    throw new Error(
      `cannot baseline onto the collector — this database is NOT at the current schema.\n` +
        problems.map((p) => `  • ${p}`).join("\n") +
        `\n  Converge first (the live aggregate schema is materialised via 'pnpm db:push'/drizzle-kit\n` +
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

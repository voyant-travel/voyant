/**
 * Deployment migration runner — cut over to the D.1 multi-source collector
 * (`@voyant-travel/framework-migrations`). Applies, in order:
 *
 *   1. the framework bundle  (@voyant-travel/framework-migrations `migrations/`)
 *   2. this deployment's own migrations (./migrations — cross-module pivot
 *      tables + any custom src/modules + src/extensions schema)
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
 * NOTE: `./migrations` now holds the *deployment* source (was `./migrations-d1`).
 * The pre-collector legacy single-folder aggregate history that used to live here
 * was REMOVED in the folder collapse — it was incomplete (16 live tables, e.g.
 * operations/ground + quote versioning, had no CREATE migration) and stale (~40
 * retired-table CREATEs), so it was never a valid replay source. The canonical
 * schema is materialised by `drizzle-kit push` of the aggregate (see the replay
 * oracle in scripts/verify-migration-replay-parity.mjs).
 * See docs/architecture/migration-collector-d1.md.
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
const deploymentFolder = path.resolve(scriptsDir, "../migrations")

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
 * converged DB), and every expected COLUMN — both the columns declared inside
 * `CREATE TABLE (…)` bodies and the ones added later via `ALTER … ADD COLUMN`.
 *
 * Parsing the whole plan, statement by statement, is what makes this a real
 * parity check rather than a table-name census: a CREATE-name-only scan misses
 * the columns inside a table body AND the `custom_fields` columns added by ALTER
 * (0001-3), and never subtracts `custom_field_values` dropped by 0004 — so it
 * could falsely baseline a DB that is missing a baseline-declared column (then
 * record the migrations as applied and skip that DDL forever), and falsely
 * reject a correctly converged DB that no longer has the dropped table.
 */
interface ExpectedSchema {
  /** Tables that must EXIST at baseline (created and not subsequently dropped). */
  tables: Set<string>
  /** Tables the plan drops — must be ABSENT in a converged DB. */
  dropped: Set<string>
  /** Every expected column on a net table — `table.column`. */
  columns: Set<string>
  /**
   * Constraints the plan DROPs (net, on tables that still exist) — must be
   * ABSENT in a converged DB. A constraint-only migration (e.g. a framework
   * bundle that drops a now-decoupled cross-package FK) changes no table or
   * column, so without this an existing legacy deployment would import-baseline
   * it as applied while the constraint physically lingers — leaving the schema
   * permanently diverged.
   */
  droppedConstraints: Set<string>
}

/**
 * Column names declared in a `CREATE TABLE` body. Column definitions start with
 * a quoted identifier; table-level constraints (`CONSTRAINT`/`PRIMARY KEY`/
 * `FOREIGN KEY`/`UNIQUE`/`CHECK`) start with a keyword, so a leading quote
 * reliably distinguishes a column line.
 */
function columnsInCreateBody(body: string): string[] {
  const cols: string[] = []
  for (const line of body.split("\n")) {
    const col = line.trim().match(/^"([a-z0-9_]+)"\s+\S/)
    if (col) cols.push(col[1] as string)
  }
  return cols
}

function expectedSchema(sources: MigrationSource[]): ExpectedSchema {
  const tables = new Set<string>()
  const dropped = new Set<string>()
  const columnsByTable = new Map<string, Set<string>>()
  const addColumn = (table: string, column: string) => {
    let set = columnsByTable.get(table)
    if (!set) {
      set = new Set<string>()
      columnsByTable.set(table, set)
    }
    set.add(column)
  }

  // `constraintName -> owning table` for constraints the plan drops (net). A
  // later ADD CONSTRAINT or a DROP of the owning table clears it.
  const droppedConstraintTable = new Map<string, string>()

  // Drizzle separates statements with `--> statement-breakpoint`. Classify each
  // in plan order: CREATE adds a table + its body columns, DROP removes both and
  // records the table as must-be-absent, ALTER … ADD COLUMN records a column,
  // ALTER … {ADD,DROP} CONSTRAINT tracks the net set of dropped constraints.
  const createRe = /^CREATE TABLE (?:IF NOT EXISTS )?"([a-z0-9_]+)"\s*\(([\s\S]*)\)/i
  const dropRe = /^DROP TABLE (?:IF EXISTS )?"([a-z0-9_]+)"/i
  const alterRe = /^ALTER TABLE "([a-z0-9_]+)" ADD COLUMN (?:IF NOT EXISTS )?"([a-z0-9_]+)"/i
  const dropConstraintRe = /^ALTER TABLE "([a-z0-9_]+)" DROP CONSTRAINT (?:IF EXISTS )?"([^"]+)"/i
  const addConstraintRe = /^ALTER TABLE "([a-z0-9_]+)" ADD CONSTRAINT "([^"]+)"/i
  for (const m of planMigrations(sources)) {
    for (const raw of m.sql.split("--> statement-breakpoint")) {
      const stmt = raw.trim()
      const create = stmt.match(createRe)
      if (create) {
        const [, name, body] = create as unknown as [string, string, string]
        tables.add(name)
        dropped.delete(name)
        for (const col of columnsInCreateBody(body)) addColumn(name, col)
        continue
      }
      const drop = stmt.match(dropRe)
      if (drop) {
        const name = drop[1] as string
        tables.delete(name)
        columnsByTable.delete(name)
        dropped.add(name)
        // The dropped table takes its constraints with it; the table-absence
        // check covers them, so stop tracking them as standalone drops.
        for (const [con, tbl] of droppedConstraintTable) {
          if (tbl === name) droppedConstraintTable.delete(con)
        }
        continue
      }
      const alter = stmt.match(alterRe)
      if (alter) {
        addColumn(alter[1] as string, alter[2] as string)
        continue
      }
      const dropCon = stmt.match(dropConstraintRe)
      if (dropCon) {
        droppedConstraintTable.set(dropCon[2] as string, dropCon[1] as string)
        continue
      }
      const addCon = stmt.match(addConstraintRe)
      if (addCon) {
        droppedConstraintTable.delete(addCon[2] as string) // re-added → not dropped
      }
    }
  }

  // Only require columns on tables that still exist in the net schema.
  const columns = new Set<string>()
  for (const [table, cols] of columnsByTable) {
    if (!tables.has(table)) continue
    for (const col of cols) columns.add(`${table}.${col}`)
  }
  // Only require absence of constraints whose owning table still exists.
  const droppedConstraints = new Set<string>()
  for (const [con, tbl] of droppedConstraintTable) {
    if (tables.has(tbl)) droppedConstraints.add(con)
  }
  return { tables, dropped, columns, droppedConstraints }
}

/**
 * Guard a baseline-import: the live DB must already match the schema the plan
 * would produce — every net table present, every added column present, every
 * dropped table gone, and every dropped constraint gone. Otherwise we refuse
 * rather than record a false baseline (which would skip real migrations forever).
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
  const liveConstraintRows = await client.query<{ conname: string }>(
    `SELECT c.conname FROM pg_constraint c
       JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public'`,
  )
  const liveConstraints = new Set(liveConstraintRows.rows.map((r) => r.conname))

  const missingTables = [...expected.tables].filter((t) => !liveTables.has(t)).sort()
  const missingColumns = [...expected.columns].filter((c) => !liveColumns.has(c)).sort()
  const lingeringDropped = [...expected.dropped].filter((t) => liveTables.has(t)).sort()
  const lingeringConstraints = [...expected.droppedConstraints]
    .filter((c) => liveConstraints.has(c))
    .sort()

  const problems: string[] = []
  const sample = (xs: string[]) => `${xs.slice(0, 8).join(", ")}${xs.length > 8 ? ", …" : ""}`
  if (missingTables.length > 0) {
    problems.push(`${missingTables.length} expected table(s) missing: ${sample(missingTables)}`)
  }
  if (missingColumns.length > 0) {
    problems.push(`${missingColumns.length} expected column(s) missing: ${sample(missingColumns)}`)
  }
  if (lingeringConstraints.length > 0) {
    problems.push(
      `${lingeringConstraints.length} constraint(s) the plan drops still present: ` +
        `${sample(lingeringConstraints)} (run the relevant DROP CONSTRAINT so the DB matches the final schema)`,
    )
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
  const deployment: MigrationSource = {
    name: "deployment",
    priority: 1,
    migrations: await loadMigrationFolder(deploymentFolder),
  }
  const sources = [bundle, deployment]

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

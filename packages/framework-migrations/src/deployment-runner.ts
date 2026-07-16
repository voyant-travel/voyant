/**
 * Deployment-migration engine — the portable core a deployment's
 * `scripts/migrate.ts` wraps. Given a ledger client, the discovered+loaded
 * migration `sources` (package sources deps-first, the deployment's own
 * migrations last) and the per-source `cutline`, this:
 *   1. detects whether the database is FRESH or an EXISTING pre-collector deployment
 *      (a `framework/*` ledger row from the retired monolithic bundle, or the legacy
 *      `drizzle.__drizzle_migrations`);
 *   2. on EXISTING, gates the import-baseline with a schema-parity check over
 *      exactly the cutline-covered migrations (so we never record a baseline the
 *      DB doesn't actually have);
 *   3. runs {@link applyMigrations}.
 *
 * Free of dotenv/config/process concerns so it can be driven against an
 * arbitrary database in tests. See docs/architecture/migration-collector-d2.md.
 */

import type { MigrationClient, MigrationSource } from "./collector.js"
import { applyMigrations, planMigrations, VOYANT_MIGRATION_JOURNAL_LINEAGE } from "./collector.js"
import type { Cutline } from "./cutline.js"

export interface RunResult {
  /** True if the EXISTING (import-baseline) path was taken. */
  existing: boolean
  /** `"{source}/{tag}"` ids whose SQL executed this run. */
  executed: string[]
  /** `"{source}/{tag}"` ids import-baselined (recorded, not executed) this run. */
  baselined: string[]
}

/** Row count of a ledger table (0 if it doesn't exist), optional WHERE. */
async function ledgerRowCount(
  client: MigrationClient,
  qualified: string,
  where = "",
): Promise<number> {
  const exists = await client.query(`SELECT to_regclass($1) AS reg`, [qualified])
  if (!exists.rows[0]?.reg) return 0
  const count = await client.query(
    `SELECT count(*)::text AS n FROM ${qualified}${where ? ` WHERE ${where}` : ""}`,
  )
  return Number((count.rows[0]?.n as string | undefined) ?? 0)
}

/**
 * EXISTING when the retired monolithic bundle or the legacy runner already materialised
 * this schema: a `framework/*` collector-ledger row, or the pre-collector
 * `drizzle.__drizzle_migrations` table. Else FRESH.
 */
export async function detectExisting(client: MigrationClient): Promise<boolean> {
  const ledger = `"${VOYANT_MIGRATION_JOURNAL_LINEAGE.ledgerSchema}"."${VOYANT_MIGRATION_JOURNAL_LINEAGE.ledgerTable}"`
  const frameworkRows = await ledgerRowCount(client, ledger, `"source" = 'framework'`)
  if (frameworkRows > 0) return true
  const graphSchemaRows = await ledgerRowCount(
    client,
    ledger,
    `"source" LIKE 'schema:%#migrations'`,
  )
  if (graphSchemaRows > 0) return true
  const legacyRows = await ledgerRowCount(client, `"drizzle"."__drizzle_migrations"`)
  return legacyRows > 0
}

interface ExpectedSchema {
  tables: Set<string>
  dropped: Set<string>
  columns: Set<string>
  droppedConstraints: Set<string>
}

/**
 * Column names declared in a `CREATE TABLE` body. Column definitions start with
 * a quoted identifier; table-level constraints start with a keyword, so a
 * leading quote reliably distinguishes a column line.
 */
function columnsInCreateBody(body: string): string[] {
  const cols: string[] = []
  for (const line of body.split("\n")) {
    const col = line.trim().match(/^"([a-z0-9_]+)"\s+\S/)
    if (col) cols.push(col[1] as string)
  }
  return cols
}

/**
 * The net schema a set of sources produces, reduced to what we can verify
 * against a live DB without executing anything. Parsed statement-by-statement
 * (not a CREATE-name census) so it sees columns inside `CREATE TABLE` bodies AND
 * `ALTER … ADD COLUMN`, and subtracts dropped tables/constraints.
 */
export function expectedSchema(sources: MigrationSource[]): ExpectedSchema {
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
  const droppedConstraintTable = new Map<string, string>()

  const createRe = /^CREATE TABLE (?:IF NOT EXISTS )?"([a-z0-9_]+)"\s*\(([\s\S]*)\)/i
  const dropRe = /^DROP TABLE (?:IF EXISTS )?"([a-z0-9_]+)"/i
  const alterRe = /^ALTER TABLE "([a-z0-9_]+)" ADD COLUMN (?:IF NOT EXISTS )?"([a-z0-9_]+)"/i
  const dropColumnRe = /^ALTER TABLE "([a-z0-9_]+)" DROP COLUMN (?:IF EXISTS )?"([a-z0-9_]+)"/i
  const renameColumnRe =
    /^ALTER TABLE "([a-z0-9_]+)" RENAME COLUMN "([a-z0-9_]+)" TO "([a-z0-9_]+)"/i
  const dropConstraintRe = /^ALTER TABLE "([a-z0-9_]+)" DROP CONSTRAINT (?:IF EXISTS )?"([^"]+)"/i
  const addConstraintRe = /^ALTER TABLE "([a-z0-9_]+)" ADD CONSTRAINT "([^"]+)"/i
  for (const m of planMigrations(sources)) {
    for (const raw of m.sql.split("--> statement-breakpoint")) {
      const stmt = raw.trim()
      const create = stmt.match(createRe)
      if (create) {
        const name = create[1] as string
        const body = create[2] as string
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
      // A column added by an earlier migration and DROPPED by a later one is NOT
      // expected at baseline — without this a deployment whose own migrations
      // add-then-drop a column (e.g. an experiment later reverted) would have the
      // parity check demand a column that is correctly absent. Net add/drop wins.
      const dropColumn = stmt.match(dropColumnRe)
      if (dropColumn) {
        columnsByTable.get(dropColumn[1] as string)?.delete(dropColumn[2] as string)
        continue
      }
      // A column renamed by a later migration is expected under its NEW name, not
      // the original the baseline declared (e.g. a deployment that renames a
      // package column). Without this the parity check demands the old name.
      const renameColumn = stmt.match(renameColumnRe)
      if (renameColumn) {
        const cols = columnsByTable.get(renameColumn[1] as string)
        if (cols?.delete(renameColumn[2] as string)) cols.add(renameColumn[3] as string)
        continue
      }
      const dropCon = stmt.match(dropConstraintRe)
      if (dropCon) {
        droppedConstraintTable.set(dropCon[2] as string, dropCon[1] as string)
        continue
      }
      const addCon = stmt.match(addConstraintRe)
      if (addCon) droppedConstraintTable.delete(addCon[2] as string)
    }
  }

  const columns = new Set<string>()
  for (const [table, cols] of columnsByTable) {
    if (!tables.has(table)) continue
    for (const col of cols) columns.add(`${table}.${col}`)
  }
  const droppedConstraints = new Set<string>()
  for (const [con, tbl] of droppedConstraintTable) {
    if (tables.has(tbl)) droppedConstraints.add(con)
  }
  return { tables, dropped, columns, droppedConstraints }
}

/**
 * Guard an import-baseline: the live DB must already match the schema `sources`
 * (the cutline-covered migrations) would produce. Throws with a diagnostic
 * rather than record a false baseline (which would skip real migrations forever).
 */
export async function assertSchemaAtBaseline(
  client: MigrationClient,
  sources: MigrationSource[],
): Promise<void> {
  const expected = expectedSchema(sources)

  const liveTablesRows = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  )
  const liveTables = new Set(liveTablesRows.rows.map((r) => r.table_name as string))
  const liveColsRows = await client.query(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
  )
  const liveColumns = new Set(
    liveColsRows.rows.map((r) => `${r.table_name as string}.${r.column_name as string}`),
  )
  const liveConstraintRows = await client.query(
    `SELECT c.conname FROM pg_constraint c
       JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public'`,
  )
  const liveConstraints = new Set(liveConstraintRows.rows.map((r) => r.conname as string))

  const missingTables = [...expected.tables].filter((t) => !liveTables.has(t)).sort()
  const missingColumns = [...expected.columns].filter((c) => !liveColumns.has(c)).sort()
  const lingeringDropped = [...expected.dropped].filter((t) => liveTables.has(t)).sort()
  const lingeringConstraints = [...expected.droppedConstraints]
    .filter((c) => liveConstraints.has(c))
    .sort()

  const problems: string[] = []
  const sample = (xs: string[]) => `${xs.slice(0, 8).join(", ")}${xs.length > 8 ? ", …" : ""}`
  if (missingTables.length > 0)
    problems.push(`${missingTables.length} expected table(s) missing: ${sample(missingTables)}`)
  if (missingColumns.length > 0)
    problems.push(`${missingColumns.length} expected column(s) missing: ${sample(missingColumns)}`)
  if (lingeringConstraints.length > 0)
    problems.push(
      `${lingeringConstraints.length} constraint(s) the plan drops still present: ` +
        `${sample(lingeringConstraints)} (run the relevant DROP CONSTRAINT so the DB matches the final schema)`,
    )
  if (lingeringDropped.length > 0)
    problems.push(
      `${lingeringDropped.length} table(s) the plan drops still present: ${sample(lingeringDropped)} ` +
        `(run the relevant backfill/cleanup so the DB matches the final schema)`,
    )
  if (problems.length > 0) {
    throw new Error(
      `cannot baseline onto the collector — this database is NOT at the cutline schema.\n` +
        problems.map((p) => `  • ${p}`).join("\n") +
        `\n  The import-baseline path only records the cutline as applied; it does NOT alter the\n` +
        `  schema. It is for a database ALREADY AT the cutline (a prior deployment of the\n` +
        `  SAME package versions). A database that is behind must first reach the cutline schema\n` +
        `  through its normal migration path — NOT 'drizzle-kit push' (unsafe in production). If\n` +
        `  this is a disposable/fresh environment, drop it and let the FRESH path execute every\n` +
        `  migration from scratch instead.`,
    )
  }
}

/** The cutline-covered subset of `sources` (only tags listed in `cutline`). */
function cutlineCovered(sources: MigrationSource[], cutline: Cutline): MigrationSource[] {
  return sources
    .map((s) => ({
      ...s,
      migrations: s.migrations.filter((m) => (cutline[s.name] ?? []).includes(m.tag)),
    }))
    .filter((s) => s.migrations.length > 0)
}

/**
 * Drop migrations already recorded in the ledger (under the source's stable OR
 * legacy names). The baseline parity gate must only assert the schema of
 * cutline entries it is ABOUT to import-baseline: once an entry is recorded,
 * later post-cutline migrations may legitimately have altered or dropped its
 * objects (e.g. a recorded source's outbox table retired by its own
 * increment), so re-asserting the cutline-era schema on every run would wedge
 * a partially-adopted database forever.
 */
async function withoutRecordedMigrations(
  client: MigrationClient,
  sources: MigrationSource[],
): Promise<MigrationSource[]> {
  if (sources.length === 0) return sources
  const ledger = `"${VOYANT_MIGRATION_JOURNAL_LINEAGE.ledgerSchema}"."${VOYANT_MIGRATION_JOURNAL_LINEAGE.ledgerTable}"`
  const recordedRows = await client.query(`SELECT "source", "tag" FROM ${ledger}`)
  const recorded = new Set(
    recordedRows.rows.map((row) => `${row.source as string}\0${row.tag as string}`),
  )
  const isRecorded = (source: MigrationSource, tag: string) =>
    [source.name, ...(source.legacyNames ?? [])].some((name) => recorded.has(`${name}\0${tag}`))

  return sources
    .map((s) => ({ ...s, migrations: s.migrations.filter((m) => !isRecorded(s, m.tag)) }))
    .filter((s) => s.migrations.length > 0)
}

/**
 * Run the deployment's migrations against `client`'s ledger. Detects FRESH vs
 * EXISTING, gates the EXISTING baseline with a parity check, and applies.
 */
export async function runDeploymentMigrations(
  client: MigrationClient,
  sources: MigrationSource[],
  cutline: Cutline,
  hooks?: { onApplied?: (id: string) => void; onBaselined?: (id: string) => void },
): Promise<RunResult> {
  const existing = await detectExisting(client)
  if (existing) {
    // Parity-gate only the cutline entries this run will import-baseline;
    // already-recorded entries' objects may have been legitimately reshaped by
    // applied post-cutline migrations.
    const pending = await withoutRecordedMigrations(client, cutlineCovered(sources, cutline))
    if (pending.length > 0) await assertSchemaAtBaseline(client, pending)
  }
  const { executed, baselined } = await applyMigrations(client, sources, {
    cutline,
    existing,
    onApplied: hooks?.onApplied,
    onBaselined: hooks?.onBaselined,
  })
  return { existing, executed, baselined }
}

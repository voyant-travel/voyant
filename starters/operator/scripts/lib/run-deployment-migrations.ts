/**
 * D.2 deployment-migration engine (testable core of `scripts/migrate.ts`).
 *
 * Given a ledger client, the discovered+loaded migration `sources` (package
 * sources deps-first, the deployment's `./migrations` last) and the per-source
 * `cutline`, this:
 *   1. detects whether the database is FRESH or an EXISTING pre-D.2 deployment
 *      (a `framework/*` ledger row from the retired D.1 bundle, or the legacy
 *      `drizzle.__drizzle_migrations`);
 *   2. on EXISTING, gates the import-baseline with a schema-parity check over
 *      exactly the cutline-covered migrations (so we never record a baseline the
 *      DB doesn't actually have);
 *   3. runs {@link applyD2Migrations}.
 *
 * Kept free of dotenv/config/process concerns so it can be driven against an
 * arbitrary database in tests. See docs/architecture/migration-collector-d2.md.
 */
import {
  applyD2Migrations,
  type Cutline,
  type MigrationClient,
  type MigrationSource,
  planMigrations,
} from "@voyant-travel/framework-migrations"

export interface RunResult {
  /** True if the EXISTING (import-baseline) path was taken. */
  existing: boolean
  /** `"{source}/{tag}"` ids whose SQL executed this run. */
  executed: string[]
  /** `"{source}/{tag}"` ids import-baselined (recorded, not executed) this run. */
  baselined: string[]
}

/** Minimal client that also reports `rowCount` (node-postgres does). */
type CountingClient = MigrationClient & {
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>
}

/** Row count of a ledger table (0 if it doesn't exist), optional WHERE. */
async function ledgerRowCount(
  client: CountingClient,
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
 * EXISTING when the retired D.1 bundle or the legacy runner already materialised
 * this schema: a `framework/*` collector-ledger row, or the pre-collector
 * `drizzle.__drizzle_migrations` table. Else FRESH.
 */
export async function detectExisting(client: CountingClient): Promise<boolean> {
  const frameworkRows = await ledgerRowCount(
    client,
    `"drizzle"."_voyant_migrations"`,
    `"source" = 'framework'`,
  )
  if (frameworkRows > 0) return true
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
  client: CountingClient,
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
      `cannot baseline onto the D.2 collector — this database is NOT at the cutline schema.\n` +
        problems.map((p) => `  • ${p}`).join("\n") +
        `\n  Converge first (the live aggregate schema is materialised via 'pnpm db:push'/drizzle-kit\n` +
        `  push for tables with no baseline migration), then re-run this migration to baseline.`,
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
 * Run the deployment's migrations against `client`'s ledger. Detects FRESH vs
 * EXISTING, gates the EXISTING baseline with a parity check, and applies.
 */
export async function runDeploymentMigrations(
  client: CountingClient,
  sources: MigrationSource[],
  cutline: Cutline,
  hooks?: { onApplied?: (id: string) => void; onBaselined?: (id: string) => void },
): Promise<RunResult> {
  const existing = await detectExisting(client)
  if (existing) {
    await assertSchemaAtBaseline(client, cutlineCovered(sources, cutline))
  }
  const { executed, baselined } = await applyD2Migrations(client, sources, {
    cutline,
    existing,
    onApplied: hooks?.onApplied,
    onBaselined: hooks?.onBaselined,
  })
  return { existing, executed, baselined }
}

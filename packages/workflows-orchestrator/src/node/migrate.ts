import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { Client } from "pg"

export interface PostgresMigration {
  id: string
  sql: string
}

export interface RunPostgresMigrationsOptions {
  databaseUrl: string
  migrationsDir?: string
  tableName?: string
  logger?: (message: string) => void
}

const DEFAULT_TABLE_NAME = "voyant_schema_migrations"

export async function runPostgresMigrations(
  opts: RunPostgresMigrationsOptions,
): Promise<{ applied: string[]; skipped: string[] }> {
  const migrationsDir = opts.migrationsDir ?? defaultMigrationsDir()
  const tableName = opts.tableName ?? DEFAULT_TABLE_NAME
  const logger = opts.logger ?? (() => {})
  const migrations = await loadPostgresMigrations(migrationsDir)

  const client = new Client({ connectionString: opts.databaseUrl })
  await client.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    const existing = await client.query<{ id: string }>(
      `SELECT id FROM ${tableName} ORDER BY id ASC`,
    )
    const appliedSet = new Set(existing.rows.map((row) => row.id))

    const applied: string[] = []
    const skipped: string[] = []

    for (const migration of migrations) {
      if (appliedSet.has(migration.id)) {
        skipped.push(migration.id)
        continue
      }

      logger(`applying ${migration.id}`)
      await client.query("BEGIN")
      try {
        await client.query(migration.sql)
        await client.query(`INSERT INTO ${tableName} (id) VALUES ($1)`, [migration.id])
        await client.query("COMMIT")
        applied.push(migration.id)
      } catch (err) {
        await client.query("ROLLBACK")
        if (isAlreadyAppliedSchemaError(err)) {
          logger(`recording existing ${migration.id}`)
          await client.query(`INSERT INTO ${tableName} (id) VALUES ($1)`, [migration.id])
          applied.push(migration.id)
          continue
        }
        throw err
      }
    }

    return { applied, skipped }
  } finally {
    await client.end()
  }
}

export async function loadPostgresMigrations(dir: string): Promise<PostgresMigration[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))

  const migrations: PostgresMigration[] = []
  for (const file of files) {
    const sql = await readFile(join(dir, file), "utf8")
    migrations.push({ id: file, sql })
  }
  return migrations
}

export function defaultMigrationsDir(): string {
  return fileURLToPath(new URL("../../migrations", import.meta.url))
}

function isAlreadyAppliedSchemaError(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code?: unknown }).code
      : undefined
  return code === "42P07" || code === "42710" || code === "42701"
}

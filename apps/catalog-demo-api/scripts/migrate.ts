/**
 * Apply pending drizzle migrations to the catalog demo DB. Runs the SQL
 * files in `migrations/` in journal order, idempotently — already-applied
 * migrations are tracked in `drizzle.__drizzle_migrations`.
 */

import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { config } from "dotenv"
import { Client } from "pg"

// Self-contained — don't inherit DATABASE_URL from the repo-root .env
// (that's the operator template's DB).
config({ path: ".env" })

const databaseUrl = process.env.CATALOG_DEMO_DATABASE_URL ?? process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error(
    "CATALOG_DEMO_DATABASE_URL (or DATABASE_URL) is not set in apps/catalog-demo-api/.env",
  )
}

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const migrationsFolder = path.resolve(scriptsDir, "../migrations")
const journalPath = path.join(migrationsFolder, "meta", "_journal.json")

interface JournalEntry {
  tag: string
  when: number
}

interface Journal {
  entries: JournalEntry[]
}

const client = new Client({ connectionString: databaseUrl })

async function ensureMigrationsTable() {
  await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"')
  await client.query(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      "id" serial PRIMARY KEY,
      "hash" text NOT NULL,
      "created_at" bigint
    )
  `)
}

async function getLastMigrationMillis(): Promise<number> {
  const result = await client.query<{ created_at: string | number }>(`
    SELECT "created_at" FROM "drizzle"."__drizzle_migrations"
    ORDER BY "created_at" DESC LIMIT 1
  `)
  if (result.rowCount === 0) return 0
  return Number(result.rows[0]?.created_at ?? 0)
}

async function applyMigration(entry: JournalEntry) {
  const migrationPath = path.join(migrationsFolder, `${entry.tag}.sql`)
  const rawSql = await fs.readFile(migrationPath, "utf8")
  const statements = rawSql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)
  const hash = crypto.createHash("sha256").update(rawSql).digest("hex")

  await client.query("BEGIN")
  try {
    for (const statement of statements) {
      await client.query(statement)
    }
    await client.query(
      `INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)`,
      [hash, entry.when],
    )
    await client.query("COMMIT")
    console.log(`applied ${entry.tag}`)
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  }
}

try {
  await client.connect()
  await ensureMigrationsTable()
  const journal = JSON.parse(await fs.readFile(journalPath, "utf8")) as Journal
  const lastMigrationMillis = await getLastMigrationMillis()
  let applied = 0
  for (const entry of journal.entries) {
    if (entry.when > lastMigrationMillis) {
      await applyMigration(entry)
      applied++
    }
  }
  if (applied === 0) {
    console.log("no pending migrations")
  }
} finally {
  await client.end()
}

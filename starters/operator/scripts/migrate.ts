import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
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
const migrationsFolder = path.resolve(scriptsDir, "../migrations")
const journalPath = path.join(migrationsFolder, "meta", "_journal.json")

type JournalEntry = {
  tag: string
  when: number
}

type Journal = {
  entries: JournalEntry[]
}

const client = new Client({
  connectionString: databaseUrl,
})

async function readJournal(): Promise<Journal> {
  const raw = await fs.readFile(journalPath, "utf8")
  return JSON.parse(raw) as Journal
}

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
  const result = await client.query<{
    created_at: string | number
  }>(`
    SELECT "created_at"
    FROM "drizzle"."__drizzle_migrations"
    ORDER BY "created_at" DESC
    LIMIT 1
  `)

  if (result.rowCount === 0) {
    return 0
  }

  return Number(result.rows[0]?.created_at ?? 0)
}

async function applyMigration(entry: JournalEntry) {
  const migrationPath = path.join(migrationsFolder, `${entry.tag}.sql`)
  const rawSql = await fs.readFile(migrationPath, "utf8")
  const statements = rawSql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)
  const hash = crypto.createHash("sha256").update(rawSql).digest("hex")

  await client.query("BEGIN")

  try {
    for (const statement of statements) {
      await client.query(statement)
    }

    await client.query(
      `
        INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
        VALUES ($1, $2)
      `,
      [hash, entry.when],
    )

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  }
}

try {
  await client.connect()
  await ensureMigrationsTable()

  const journal = await readJournal()
  const lastMigrationMillis = await getLastMigrationMillis()
  const applied: string[] = []

  for (const entry of journal.entries) {
    if (entry.when > lastMigrationMillis) {
      await applyMigration(entry)
      applied.push(entry.tag)
      console.log(`✓ applied ${entry.tag}`)
    }
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
    console.log(`Applied ${applied.length} migration(s).`)
    console.log("⚠️  Restart any long-lived workers / dev servers now —")
    console.log("    drizzle's prepared-statement cache is keyed to the old schema.")
  }
} finally {
  await client.end()
}

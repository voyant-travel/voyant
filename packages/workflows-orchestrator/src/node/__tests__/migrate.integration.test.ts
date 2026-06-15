import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { runPostgresMigrations } from "../migrate.js"
import { createPostgresConnection } from "../postgres.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip

describeIfDb("runPostgresMigrations", () => {
  let connection: ReturnType<typeof createPostgresConnection>
  let tempDir: string

  beforeAll(async () => {
    connection = createPostgresConnection({ databaseUrl: TEST_DATABASE_URL! })
    tempDir = await mkdtemp(join(tmpdir(), "voyant-pg-migrations-"))
    await writeFile(
      join(tempDir, "0000_init.sql"),
      "CREATE TABLE IF NOT EXISTS migration_probe (id text PRIMARY KEY);",
    )
    await writeFile(
      join(tempDir, "0001_seed.sql"),
      "INSERT INTO migration_probe (id) VALUES ('first');",
    )
    await connection.db.execute(sql`DROP TABLE IF EXISTS voyant_schema_migrations`)
    await connection.db.execute(sql`DROP TABLE IF EXISTS migration_probe`)
  }, 20_000)

  afterAll(async () => {
    await connection.db.execute(sql`DROP TABLE IF EXISTS voyant_schema_migrations`)
    await connection.db.execute(sql`DROP TABLE IF EXISTS migration_probe`)
    await connection.close()
    await rm(tempDir, { recursive: true, force: true })
  }, 20_000)

  it("applies each SQL file once and records migration ids", async () => {
    const first = await runPostgresMigrations({
      databaseUrl: TEST_DATABASE_URL!,
      migrationsDir: tempDir,
    })
    expect(first.applied).toEqual(["0000_init.sql", "0001_seed.sql"])
    expect(first.skipped).toEqual([])

    const rows = await connection.db.execute<{ id: string }>(sql`SELECT id FROM migration_probe`)
    expect(rows.rows).toEqual([{ id: "first" }])

    const second = await runPostgresMigrations({
      databaseUrl: TEST_DATABASE_URL!,
      migrationsDir: tempDir,
    })
    expect(second.applied).toEqual([])
    expect(second.skipped).toEqual(["0000_init.sql", "0001_seed.sql"])
  })
})

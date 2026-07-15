import { describe, expect, it } from "vitest"

import {
  applyMigrations,
  type MigrationClient,
  VOYANT_MIGRATION_JOURNAL_LINEAGE,
} from "./collector.js"
import { detectExisting } from "./deployment-runner.js"

const QUALIFIED_LEDGER = `"${VOYANT_MIGRATION_JOURNAL_LINEAGE.ledgerSchema}"."${VOYANT_MIGRATION_JOURNAL_LINEAGE.ledgerTable}"`

describe("migration journal lineage", () => {
  it("creates the exported default journal for every deployment mode", async () => {
    const queries: string[] = []
    const client: MigrationClient = {
      async query(sql) {
        queries.push(sql)
        return { rows: [] }
      },
    }

    await applyMigrations(client, [])

    expect(VOYANT_MIGRATION_JOURNAL_LINEAGE).toEqual({
      schemaVersion: "voyant.migration-journal-lineage.v1",
      ledgerSchema: "drizzle",
      ledgerTable: "_voyant_migrations",
      identityColumns: ["source", "tag"],
      contentHashColumn: "content_hash",
    })
    expect(queries).toContain(`CREATE SCHEMA IF NOT EXISTS "drizzle"`)
    expect(
      queries.some((sql) => sql.includes(`CREATE TABLE IF NOT EXISTS ${QUALIFIED_LEDGER}`)),
    ).toBe(true)
  })

  it("recognizes restored databases through that same journal", async () => {
    const registryLookups: unknown[] = []
    const client: MigrationClient = {
      async query(sql, params) {
        if (sql.startsWith("SELECT to_regclass")) {
          registryLookups.push(params?.[0])
          return { rows: [{ reg: null }] }
        }
        return { rows: [] }
      },
    }

    await expect(detectExisting(client)).resolves.toBe(false)
    expect(registryLookups.slice(0, 2)).toEqual([QUALIFIED_LEDGER, QUALIFIED_LEDGER])
  })
})

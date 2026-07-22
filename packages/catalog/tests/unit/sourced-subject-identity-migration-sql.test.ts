import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  new URL("../../migrations/20260722150000_sourced_subject_identity.sql", import.meta.url),
  "utf8",
)

describe("sourced presentation-subject identity migration", () => {
  it("fails with deterministic reconciliation diagnostics before changing indexes", () => {
    const preflight = migration.indexOf("DO $$")
    const oldIndexDrop = migration.indexOf(
      'DROP INDEX IF EXISTS "catalog_sourced_entries_source_uniq"',
    )

    expect(preflight).toBeGreaterThanOrEqual(0)
    expect(oldIndexDrop).toBeGreaterThan(preflight)
    expect(migration).toContain(
      'array_agg("entity_id" ORDER BY "first_seen_at", "created_at", "id")',
    )
    expect(migration).toContain("AS canonical_entity_id")
    expect(migration).toContain("identity_conflict_count")
    expect(migration).toContain("catalog_overlay_history")
    expect(migration).toContain("vertical-owned reverse references")
  })

  it("enforces separate connected and connectionless canonical identities", () => {
    expect(migration).toContain('"catalog_sourced_entries_source_connected_uniq"')
    expect(migration).toContain('"source_connection_id" IS NOT NULL')
    expect(migration).toContain('"catalog_sourced_entries_source_connectionless_uniq"')
    expect(migration).toContain('"source_connection_id" IS NULL')
  })
})

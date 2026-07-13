import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  fileURLToPath(
    new URL("../../migrations/20260713000600_backfill_custom_field_values.sql", import.meta.url),
  ),
  "utf8",
)

describe("legacy custom-field value migration", () => {
  it("is a post-cutline package migration with a clean no-op path", () => {
    expect(migration).toContain("to_regclass('public.custom_field_values') IS NULL")
    expect(migration).toContain("RETURN;")
    expect(migration).toContain("DROP TABLE custom_field_values;")
    expect(migration).not.toContain("DROP TABLE custom_field_values CASCADE")
  })

  it("keeps current entity values and validates every legacy row before retirement", () => {
    expect(migration).toContain("sub.backfilled || COALESCE(t.custom_fields, ''{}''::jsonb)")
    expect(migration).toContain("unsupported entity types")
    expect(migration).toContain("reference missing definitions")
    expect(migration).toContain("reference missing %.id values")
    expect(migration.indexOf("reference missing %.id values")).toBeLessThan(
      migration.indexOf("DROP TABLE custom_field_values;"),
    )
  })

  it.each([
    ["person", "people"],
    ["organization", "organizations"],
    ["activity", "activities"],
    ["quote", "quotes"],
  ])("maps %s values to %s", (entityType, tableName) => {
    expect(migration).toContain(`('${entityType}', '${tableName}')`)
  })
})

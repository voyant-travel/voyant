import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("custom-fields Settings authority", () => {
  it("keeps generic ownership and entity target declarations", () => {
    expect(
      execFileSync("node", [resolve("scripts/check-custom-fields-settings-authority.mjs")], {
        encoding: "utf8",
      }),
    ).toContain("OK")
  })

  it("keeps namespace ownership as a clean destructive cutover", () => {
    const migration = readFileSync(
      resolve(
        "packages/custom-fields/migrations/20260716000100_custom_field_namespace_ownership.sql",
      ),
      "utf8",
    )

    expect(migration).toContain('DELETE FROM "custom_field_definitions"')
    expect(migration).not.toMatch(/\bUPDATE\s+"custom_field_definitions"/)
    expect(migration).not.toContain("ADD COLUMN IF NOT EXISTS")
    expect(migration).not.toContain("CREATE INDEX IF NOT EXISTS")
    expect(migration).not.toMatch(/\bDEFAULT\b/)
  })
})

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync(
  new URL(
    "../../migrations/20260801173000_storefront_channel_binding_cutover.sql",
    import.meta.url,
  ),
  "utf8",
)

describe("storefront channel binding cutover", () => {
  it("creates the standard-link table before backfill and never silently returns", () => {
    expect(
      sql.indexOf('CREATE TABLE IF NOT EXISTS "auth_storefront_distribution_channel"'),
    ).toBeLessThan(sql.indexOf('INSERT INTO "auth_storefront_distribution_channel"'))
    expect(sql).not.toContain(
      "IF to_regclass('public.auth_storefront_distribution_channel') IS NULL THEN\n\t\tRETURN",
    )
    expect(sql).toContain("cutover requires the channels table")
  })

  it("uses single-label wildcard overlap semantics", () => {
    expect(sql).toContain("strpos(")
    expect(sql).toContain("substring(left_origin.origin from 11)")
    expect(sql).toContain("substring(right_origin.origin from 11)")
  })
})

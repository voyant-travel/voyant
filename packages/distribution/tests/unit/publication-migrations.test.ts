import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function migration(name: string) {
  return readFileSync(new URL(`../../migrations/${name}`, import.meta.url), "utf8")
}

describe("publication cutover migrations", () => {
  it("seeds a resumable catalog backfill without a channels-products cross join", () => {
    const sql = migration("20260801173500_backfill_prior_visible_catalog_publications.sql")
    expect(sql).toContain("'catalog'")
    expect(sql).toContain("ON CONFLICT DO NOTHING")
    expect(sql).not.toMatch(/CROSS\s+JOIN\s+"products"/i)
    expect(sql).not.toContain('INSERT INTO "channel_product_publications"')
  })

  it("allows channel-independent lifecycle intents", () => {
    const sql = migration("20260801143000_channel_publications.sql")
    expect(sql).toContain('"channel_id" text,')
    expect(sql).toContain("uniq_channel_pub_reindex_global_product_pending")
    expect(sql).toContain("uniq_channel_pub_reindex_global_supplier_pending")
    expect(sql).toContain("uniq_channel_pub_reindex_catalog_pending")
  })
})

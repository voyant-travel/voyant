import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"

import { catalogProductReindexStateTable } from "../../src/schema.js"

describe("catalog product reindex state schema", () => {
  it("exports the tenant-scoped lease and checkpoint table through the Catalog schema", () => {
    const table = getTableConfig(catalogProductReindexStateTable)

    expect(table.name).toBe("catalog_product_reindex_state")
    expect(table.columns.map((column) => column.name)).toEqual([
      "tenant_id",
      "reindex_key",
      "requested_generation",
      "claimed_generation",
      "completed_generation",
      "cursor_after_id",
      "batches",
      "scanned",
      "indexed",
      "retries",
      "lease_owner",
      "lease_until",
      "completed_at",
      "updated_at",
    ])
    expect(table.primaryKeys).toHaveLength(1)
    expect(table.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
      "tenant_id",
      "reindex_key",
    ])
    expect(table.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "catalog_product_reindex_state_requested_nonnegative",
        "catalog_product_reindex_state_completed_nonnegative",
        "catalog_product_reindex_state_counters_nonnegative",
      ]),
    )
  })
})

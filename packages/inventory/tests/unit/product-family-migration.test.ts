import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { STANDARD_PRODUCT_FAMILIES } from "../../src/classification.js"

const migration = readFileSync(
  new URL("../../migrations/20260801140300_product_families_and_duration.sql", import.meta.url),
  "utf8",
)

describe("product family and duration migration", () => {
  it("adds nullable classification fields and a positive duration guard", () => {
    expect(migration).toContain(`ADD COLUMN "product_subtype_code" text`)
    expect(migration).toContain(`ADD COLUMN "duration_minutes" integer`)
    expect(migration).toContain(`CHECK ("products"."duration_minutes" > 0)`)
  })

  it("seeds every standard family idempotently by stable code", () => {
    for (const family of STANDARD_PRODUCT_FAMILIES) {
      expect(migration).toContain(`'${family.id}', '${family.code}', '${family.name}'`)
    }
    expect(migration).toContain(`ON CONFLICT ("code") DO NOTHING`)
  })
})

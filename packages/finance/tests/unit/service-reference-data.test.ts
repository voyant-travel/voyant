import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"

import { financeReferenceDataService } from "../../src/service-reference-data.js"

function makeTaxClassDb(existingRegimeIds: string[] = []) {
  const where = vi.fn().mockResolvedValue(existingRegimeIds.map((id) => ({ id })))
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))

  const returning = vi.fn().mockResolvedValue([{ id: "txcl_123" }])
  const values = vi.fn(() => ({ returning }))
  const insert = vi.fn(() => ({ values }))

  const updateReturning = vi.fn().mockResolvedValue([{ id: "txcl_123" }])
  const updateWhere = vi.fn(() => ({ returning: updateReturning }))
  const set = vi.fn(() => ({ where: updateWhere }))
  const update = vi.fn(() => ({ set }))

  return {
    db: { select, insert, update } as PostgresJsDatabase,
    insert,
    update,
  }
}

describe("financeReferenceDataService tax classes", () => {
  it("rejects create payloads with nonexistent line regime references", async () => {
    const { db, insert } = makeTaxClassDb()

    await expect(
      financeReferenceDataService.createTaxClass(db, {
        code: "invalid-line-regime",
        label: "Invalid line regime",
        active: true,
        lines: [{ regime_id: "txrg_missing", applies_to: "all" }],
      }),
    ).rejects.toMatchObject({
      name: "ReferenceDataValidationError",
      code: "invalid_reference",
      details: { missingRegimeIds: ["txrg_missing"] },
    })
    expect(insert).not.toHaveBeenCalled()
  })

  it("rejects update payloads with nonexistent default or line regime references", async () => {
    const { db, update } = makeTaxClassDb(["txrg_existing"])

    await expect(
      financeReferenceDataService.updateTaxClass(db, "txcl_123", {
        defaultRegimeId: "txrg_existing",
        lines: [{ regime_id: "txrg_missing", applies_to: "base" }],
      }),
    ).rejects.toMatchObject({
      name: "ReferenceDataValidationError",
      code: "invalid_reference",
      details: { missingRegimeIds: ["txrg_missing"] },
    })
    expect(update).not.toHaveBeenCalled()
  })
})

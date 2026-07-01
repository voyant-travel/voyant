import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { financeReferenceDataRoutes } from "../../src/routes-reference-data.js"
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
    values,
    set,
  }
}

describe("financeReferenceDataService tax classes", () => {
  it("rejects create payloads with nonexistent default regime references", async () => {
    const { db, insert } = makeTaxClassDb()

    await expect(
      financeReferenceDataService.createTaxClass(db, {
        code: "invalid-default-regime",
        label: "Invalid default regime",
        active: true,
        defaultRegimeId: "txrg_missing",
      }),
    ).rejects.toMatchObject({
      name: "ReferenceDataValidationError",
      code: "invalid_reference",
      details: { missingRegimeIds: ["txrg_missing"] },
    })
    expect(insert).not.toHaveBeenCalled()
  })

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

  it("creates tax classes when all referenced tax regimes exist", async () => {
    const { db, values } = makeTaxClassDb(["txrg_default", "txrg_line"])

    await expect(
      financeReferenceDataService.createTaxClass(db, {
        code: "valid-regimes",
        label: "Valid regimes",
        active: true,
        defaultRegimeId: "txrg_default",
        lines: [{ regime_id: "txrg_line", applies_to: "base" }],
      }),
    ).resolves.toEqual({ id: "txcl_123" })

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultRegimeId: "txrg_default",
        lines: [{ regime_id: "txrg_line", applies_to: "base" }],
      }),
    )
  })

  it("updates tax classes when submitted tax regime references exist", async () => {
    const { db, set } = makeTaxClassDb(["txrg_existing"])

    await expect(
      financeReferenceDataService.updateTaxClass(db, "txcl_123", {
        defaultRegimeId: "txrg_existing",
      }),
    ).resolves.toEqual({ id: "txcl_123" })

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultRegimeId: "txrg_existing",
      }),
    )
  })

  it("returns handled 400 responses for missing tax-regime references", async () => {
    const { db } = makeTaxClassDb()
    const app = new Hono()
      .use("*", async (c, next) => {
        c.set("db", db)
        await next()
      })
      .route("/", financeReferenceDataRoutes)

    const response = await app.request("/tax-classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "invalid-default-regime",
        label: "Invalid default regime",
        active: true,
        defaultRegimeId: "txrg_missing",
      }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Tax class references unknown tax regimes",
      code: "invalid_reference",
      details: { missingRegimeIds: ["txrg_missing"] },
    })
  })
})

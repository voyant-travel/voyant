import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"

import { createPriceSchedule } from "./service-catalogs.js"
import { insertPriceScheduleSchema } from "./validation.js"

/**
 * `createPriceSchedule` runs a pre-write existence check on `priceCatalogId`
 * (`select().from().where().limit()`) before inserting. The mock resolves that
 * lookup to either an existing catalog row or an empty result.
 */
function makePriceScheduleDb(opts: { catalogExists: boolean }) {
  const limit = vi.fn().mockResolvedValue(opts.catalogExists ? [{ id: "price_catalogs_1" }] : [])
  const where = vi.fn(() => ({ limit }))
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))

  const returning = vi.fn().mockResolvedValue([{ id: "price_schedules_1" }])
  const values = vi.fn(() => ({ returning }))
  const insert = vi.fn(() => ({ values }))

  const updateReturning = vi.fn().mockResolvedValue([{ id: "price_schedules_1" }])
  const updateWhere = vi.fn(() => ({ returning: updateReturning }))
  const set = vi.fn(() => ({ where: updateWhere }))
  const update = vi.fn(() => ({ set }))

  return { db: { select, insert, update } as PostgresJsDatabase, insert }
}

const validScheduleInput = insertPriceScheduleSchema.parse({
  priceCatalogId: "price_catalogs_00000000000000000000000",
  name: "High season",
  recurrenceRule: "FREQ=DAILY",
})

describe("createPriceSchedule dangling catalog guard", () => {
  it("rejects a nonexistent priceCatalogId with a deterministic invalid_reference 400", async () => {
    const { db, insert } = makePriceScheduleDb({ catalogExists: false })

    await expect(createPriceSchedule(db, validScheduleInput)).rejects.toMatchObject({
      name: "ApiHttpError",
      status: 400,
      code: "invalid_reference",
      details: { missingPriceCatalogId: "price_catalogs_00000000000000000000000" },
    })
    expect(insert).not.toHaveBeenCalled()
  })

  it("inserts when the referenced price catalog exists", async () => {
    const { db, insert } = makePriceScheduleDb({ catalogExists: true })

    await expect(createPriceSchedule(db, validScheduleInput)).resolves.toEqual({
      id: "price_schedules_1",
    })
    expect(insert).toHaveBeenCalledOnce()
  })
})

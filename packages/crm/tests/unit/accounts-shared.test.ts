import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterEach, describe, expect, it, vi } from "vitest"

import { hydratePeople } from "../../src/service/accounts-shared.js"

describe("hydratePeople", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("throws by default when directory hydration fails", async () => {
    const expectedError = new Error("identity binding unavailable")
    const db = {
      select: () => ({
        from: () => ({
          where: async () => {
            throw expectedError
          },
        }),
      }),
    } as PostgresJsDatabase

    await expect(hydratePeople(db, [{ id: "crm_ppl_1", firstName: "Ada" }])).rejects.toBe(
      expectedError,
    )
  })

  it("returns base people rows with empty identity fields when fallback is enabled", async () => {
    const expectedError = new Error("identity binding unavailable")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const db = {
      select: () => ({
        from: () => ({
          where: async () => {
            throw expectedError
          },
        }),
      }),
    } as PostgresJsDatabase

    const rows = await hydratePeople(db, [{ id: "crm_ppl_1", firstName: "Ada" }], {
      fallbackOnError: true,
    })

    expect(rows).toEqual([
      {
        id: "crm_ppl_1",
        firstName: "Ada",
        email: null,
        phone: null,
        website: null,
      },
    ])
    expect(warn).toHaveBeenCalledWith(
      "[crm] person identity hydration failed; returning base people rows",
      {
        error: expectedError,
        personCount: 1,
      },
    )
  })
})

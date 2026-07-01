import { ApiHttpError } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"

import { createPriceCatalog } from "./service-catalogs.js"
import type { CreatePriceCatalogInput } from "./service-shared.js"

const baseCatalog: CreatePriceCatalogInput = {
  code: "rack",
  name: "Rack rates",
  catalogType: "public",
  isDefault: false,
  active: true,
}

/**
 * A duplicate `code` insert hits `uidx_price_catalogs_code`; the service uses
 * `onConflictDoNothing`, so the insert resolves to an empty `RETURNING` set.
 * This mock reproduces that "no row returned" shape without a live database.
 */
function createConflictingInsertDb(): PostgresJsDatabase {
  const insert: PostgresJsDatabase["insert"] = () =>
    ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => [],
        }),
      }),
    }) as never
  return { insert } as PostgresJsDatabase
}

describe("createPriceCatalog duplicate code conflicts", () => {
  it("maps a duplicate code to a 409 with a stable code and field context", async () => {
    let caught: unknown
    try {
      await createPriceCatalog(createConflictingInsertDb(), baseCatalog)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ApiHttpError)
    const apiError = caught as ApiHttpError
    expect(apiError.status).toBe(409)
    expect(apiError.code).toBe("duplicate_price_catalog_code")
    expect(apiError.message).toBe("Price catalog code already exists")
    expect(apiError.details).toMatchObject({
      resource: "price_catalog",
      issues: [
        {
          code: "duplicate_price_catalog_code",
          path: ["code"],
          message: "Price catalog code already exists",
        },
      ],
      fields: {
        code: ["Price catalog code already exists"],
      },
    })
  })
})

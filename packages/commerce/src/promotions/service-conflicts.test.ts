import { ApiHttpError } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"

import { promotionsService } from "./service.js"
import type { InsertPromotionalOffer, UpdatePromotionalOffer } from "./validation.js"

const baseOffer: InsertPromotionalOffer = {
  name: "Summer sale",
  slug: "summer-sale",
  discountType: "percentage",
  discountPercent: 10,
  discountAmountCents: null,
  currency: null,
  scope: { kind: "global" },
  conditions: {},
  code: null,
  stackable: false,
  active: true,
}

function uniqueViolation(constraint: string) {
  return Object.assign(
    new Error(`duplicate key value violates unique constraint "${constraint}"`),
    {
      code: "23505",
      constraint,
    },
  )
}

function wrappedUniqueViolation(constraint: string) {
  return new Error("Drizzle query failed", {
    cause: {
      code: "23505",
      constraint_name: constraint,
    },
  })
}

function createFailingInsertDb(error: unknown): PostgresJsDatabase {
  const db = {
    insert: () => ({
      values: () => ({
        returning: async () => {
          throw error
        },
      }),
    }),
  }
  return db as PostgresJsDatabase
}

function createFailingUpdateDb(error: unknown): PostgresJsDatabase {
  const db = {
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () => {
            throw error
          },
        }),
      }),
    }),
  }
  return db as PostgresJsDatabase
}

function expectConflict(error: unknown, field: "slug" | "code") {
  expect(error).toBeInstanceOf(ApiHttpError)
  const apiError = error as ApiHttpError
  expect(apiError.status).toBe(409)
  expect(apiError.code).toBe(`duplicate_promotional_offer_${field}`)
  expect(apiError.details).toMatchObject({
    resource: "promotional_offer",
    issues: [
      {
        code: `duplicate_promotional_offer_${field}`,
        path: [field],
      },
    ],
    fields: {
      [field]: [expect.any(String)],
    },
  })
}

async function expectRejectedConflict(promise: Promise<unknown>, field: "slug" | "code") {
  try {
    await promise
  } catch (error) {
    expectConflict(error, field)
    return
  }
  throw new Error("Expected promise to reject")
}

describe("promotionsService duplicate active offer conflicts", () => {
  it.each([
    ["slug", "uidx_promotional_offers_slug_active"] as const,
    ["code", "uidx_promotional_offers_code_active"] as const,
  ])("maps create duplicate %s constraints to 409 field errors", async (field, constraint) => {
    await expectRejectedConflict(
      promotionsService.createOffer(createFailingInsertDb(uniqueViolation(constraint)), baseOffer),
      field,
    )
  })

  it.each([
    ["slug", "uidx_promotional_offers_slug_active", { slug: "winter-sale" }] as const,
    ["code", "uidx_promotional_offers_code_active", { code: "WINTER10" }] as const,
  ])("maps update duplicate %s constraints to 409 field errors", async (field, constraint, patch: UpdatePromotionalOffer) => {
    await expectRejectedConflict(
      promotionsService.updateOffer(
        createFailingUpdateDb(wrappedUniqueViolation(constraint)),
        "promo_0000000000000000000000",
        patch,
      ),
      field,
    )
  })
})

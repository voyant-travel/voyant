import type { ApiHttpError } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"

import { type PromotionalOffer, promotionalOfferProducts, promotionalOffers } from "./schema.js"
import { promotionsService } from "./service.js"
import type { InsertPromotionalOffer, UpdatePromotionalOffer } from "./validation.js"

const baseOffer: InsertPromotionalOffer = {
  name: "Product sale",
  slug: "product-sale",
  discountType: "percentage",
  discountPercent: 10,
  discountAmountCents: null,
  currency: null,
  scope: { kind: "products", productIds: ["prod_valid"] },
  conditions: {},
  code: null,
  stackable: false,
  active: true,
}

const persistedOffer: PromotionalOffer = {
  id: "pofr_test",
  name: baseOffer.name,
  slug: baseOffer.slug,
  description: null,
  discountType: "percentage",
  discountPercent: "10",
  discountAmountCents: null,
  currency: null,
  scope: baseOffer.scope,
  conditions: {},
  validFrom: null,
  validUntil: null,
  code: null,
  stackable: false,
  active: true,
  metadata: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

interface FakeDbCalls {
  offerInserts: unknown[]
  offerUpdates: unknown[]
  linkDeletes: number
  linkInserts: unknown[]
}

function createPromotionDb(options: {
  existingProductIds: string[]
  executeError?: unknown
  selectedOffer?: PromotionalOffer | null
}) {
  const calls: FakeDbCalls = {
    offerInserts: [],
    offerUpdates: [],
    linkDeletes: 0,
    linkInserts: [],
  }

  const db = Object.assign(Object.create(null) as PostgresJsDatabase, {
    execute: async () => {
      if (options.executeError) throw options.executeError
      return options.existingProductIds.map((id) => ({ id }))
    },
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        if (table === promotionalOffers) {
          calls.offerInserts.push(values)
          return {
            returning: async () => [
              { ...persistedOffer, ...(values as Partial<PromotionalOffer>) },
            ],
          }
        }
        if (table === promotionalOfferProducts) {
          calls.linkInserts.push(...(Array.isArray(values) ? values : [values]))
        }
        return {}
      },
    }),
    delete: (table: unknown) => ({
      where: async () => {
        if (table === promotionalOfferProducts) calls.linkDeletes += 1
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (options.selectedOffer === undefined ? [] : [options.selectedOffer]),
        }),
      }),
    }),
    update: () => ({
      set: (values: unknown) => ({
        where: () => ({
          returning: async () => {
            calls.offerUpdates.push(values)
            return [{ ...persistedOffer, ...(values as Partial<PromotionalOffer>) }]
          },
        }),
      }),
    }),
  })

  return { db, calls }
}

function productOffer(productIds: string[]): InsertPromotionalOffer {
  return {
    ...baseOffer,
    scope: { kind: "products", productIds },
  }
}

describe("promotionsService product scope validation", () => {
  it("rejects unknown product ids before inserting offers or materialized links", async () => {
    const { db, calls } = createPromotionDb({ existingProductIds: ["prod_valid"] })

    await expect(
      promotionsService.createOffer(db, productOffer(["prod_valid", "prod_missing"])),
    ).rejects.toMatchObject({
      status: 400,
      code: "invalid_reference",
      details: {
        field: "scope.productIds",
        missingProductIds: ["prod_missing"],
      },
    } satisfies Partial<ApiHttpError>)

    expect(calls.offerInserts).toHaveLength(0)
    expect(calls.linkDeletes).toBe(0)
    expect(calls.linkInserts).toHaveLength(0)
  })

  it("returns invalid_reference instead of leaking missing Inventory schema errors", async () => {
    const { db, calls } = createPromotionDb({
      existingProductIds: [],
      executeError: Object.assign(new Error('relation "products" does not exist'), {
        code: "42P01",
      }),
    })

    await expect(
      promotionsService.createOffer(db, productOffer(["prod_valid"])),
    ).rejects.toMatchObject({
      status: 400,
      code: "invalid_reference",
      details: {
        missingProductIds: ["prod_valid"],
      },
    } satisfies Partial<ApiHttpError>)

    expect(calls.offerInserts).toHaveLength(0)
    expect(calls.linkDeletes).toBe(0)
    expect(calls.linkInserts).toHaveLength(0)
  })

  it("preserves valid product-scope creation and materializes deduped product links", async () => {
    const { db, calls } = createPromotionDb({ existingProductIds: ["prod_a", "prod_b"] })

    const row = await promotionsService.createOffer(
      db,
      productOffer(["prod_a", "prod_b", "prod_a"]),
    )

    expect(row.id).toBe("pofr_test")
    expect(calls.offerInserts).toHaveLength(1)
    expect(calls.linkDeletes).toBe(1)
    expect(calls.linkInserts).toEqual([
      { offerId: "pofr_test", productId: "prod_a" },
      { offerId: "pofr_test", productId: "prod_b" },
    ])
  })

  it("rejects unknown product ids on update without rematerializing links", async () => {
    const { db, calls } = createPromotionDb({
      existingProductIds: [],
      selectedOffer: persistedOffer,
    })
    const patch: UpdatePromotionalOffer = {
      scope: { kind: "products", productIds: ["prod_missing"] },
      conditions: {},
      stackable: false,
      active: true,
    }

    await expect(promotionsService.updateOffer(db, "pofr_test", patch)).rejects.toMatchObject({
      status: 400,
      code: "invalid_reference",
      details: {
        missingProductIds: ["prod_missing"],
      },
    } satisfies Partial<ApiHttpError>)

    expect(calls.offerUpdates).toHaveLength(0)
    expect(calls.linkDeletes).toBe(0)
    expect(calls.linkInserts).toHaveLength(0)
  })
})

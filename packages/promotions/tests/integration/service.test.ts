import { newId } from "@voyantjs/db/lib/typeid"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import {
  destinations,
  productCategories,
  productCategoryProducts,
  productDestinations,
  products,
} from "@voyantjs/products/schema"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { PROMOTION_CHANGED_EVENT, type PromotionChangedEvent } from "../../src/events.js"
import {
  promotionalOfferProducts,
  promotionalOfferRedemptions,
  promotionalOffers,
} from "../../src/schema.js"
import { promotionsService } from "../../src/service.js"
import type { InsertPromotionalOfferInput, PromotionalOfferScope } from "../../src/validation.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const DB_AVAILABLE = !!TEST_DATABASE_URL

const db: PostgresJsDatabase = DB_AVAILABLE
  ? createTestDb()
  : (null as unknown as PostgresJsDatabase)

interface RecordedEvent {
  topic: string
  payload: PromotionChangedEvent
}

function makeEventBus() {
  const recorded: RecordedEvent[] = []
  return {
    bus: {
      emit: async (topic: string, payload: unknown) => {
        recorded.push({ topic, payload: payload as PromotionChangedEvent })
      },
      // EventBus has more methods (subscribe, etc.) but the service only
      // uses `emit`. Cast at the call site to avoid pulling in the full
      // surface here.
    },
    recorded,
  }
}

const baseOffer = (
  overrides: Partial<InsertPromotionalOfferInput> = {},
): InsertPromotionalOfferInput => ({
  name: "Test Offer",
  slug: `test-offer-${Math.random().toString(36).slice(2, 8)}`,
  scope: { kind: "global" },
  discountType: "percentage",
  discountPercent: 20,
  ...overrides,
})

describe.skipIf(!DB_AVAILABLE)("promotionsService", () => {
  let productAId: string
  let productBId: string
  let productCId: string
  let categoryId: string
  let destinationId: string

  beforeAll(() => {
    productAId = newId("products")
    productBId = newId("products")
    productCId = newId("products")
    categoryId = newId("product_categories")
    destinationId = newId("destinations")
  })

  beforeEach(async () => {
    await cleanupTestDb(db)
    await db.insert(products).values([
      { id: productAId, name: "Product A", sellCurrency: "USD" },
      { id: productBId, name: "Product B", sellCurrency: "USD" },
      { id: productCId, name: "Product C", sellCurrency: "USD" },
    ])
    await db.insert(productCategories).values({
      id: categoryId,
      slug: "adventure",
      name: "Adventure",
    })
    await db.insert(productCategoryProducts).values([
      { categoryId, productId: productAId },
      { categoryId, productId: productBId },
    ])
    await db.insert(destinations).values({
      id: destinationId,
      slug: "iceland",
      name: "Iceland",
    })
    await db.insert(productDestinations).values([
      { destinationId, productId: productBId },
      { destinationId, productId: productCId },
    ])
  })

  describe("createOffer", () => {
    it("creates an offer with global scope and no link rows", async () => {
      const { bus, recorded } = makeEventBus()
      const offer = await promotionsService.createOffer(
        db,
        baseOffer({ scope: { kind: "global" } }),
        // biome-ignore lint/suspicious/noExplicitAny: test-only narrow EventBus stub
        { eventBus: bus as any },
      )
      expect(offer.id).toMatch(/^pofr_/)
      expect(offer.active).toBe(true)

      const links = await db
        .select()
        .from(promotionalOfferProducts)
        .where(eq(promotionalOfferProducts.offerId, offer.id))
      expect(links).toHaveLength(0)

      expect(recorded).toHaveLength(1)
      expect(recorded[0]?.topic).toBe(PROMOTION_CHANGED_EVENT)
      expect(recorded[0]?.payload.affected).toEqual({ kind: "all" })
      expect(recorded[0]?.payload.source).toBe("created")
    })

    it("materializes products scope into the link table", async () => {
      const { bus, recorded } = makeEventBus()
      const offer = await promotionsService.createOffer(
        db,
        baseOffer({ scope: { kind: "products", productIds: [productAId, productBId] } }),
        // biome-ignore lint/suspicious/noExplicitAny: test-only narrow EventBus stub
        { eventBus: bus as any },
      )

      const links = await db
        .select()
        .from(promotionalOfferProducts)
        .where(eq(promotionalOfferProducts.offerId, offer.id))
      expect(links.map((l) => l.productId).sort()).toEqual([productAId, productBId].sort())

      expect(recorded[0]?.payload.affected).toEqual({
        kind: "products",
        productIds: expect.arrayContaining([productAId, productBId]),
      })
    })

    it("expands categories scope to product IDs at write time", async () => {
      const offer = await promotionsService.createOffer(
        db,
        baseOffer({ scope: { kind: "categories", categoryIds: [categoryId] } }),
      )

      const links = await db
        .select({ productId: promotionalOfferProducts.productId })
        .from(promotionalOfferProducts)
        .where(eq(promotionalOfferProducts.offerId, offer.id))
      expect(links.map((l) => l.productId).sort()).toEqual([productAId, productBId].sort())
    })

    it("expands destinations scope to product IDs at write time", async () => {
      const offer = await promotionsService.createOffer(
        db,
        baseOffer({ scope: { kind: "destinations", destinationIds: [destinationId] } }),
      )

      const links = await db
        .select({ productId: promotionalOfferProducts.productId })
        .from(promotionalOfferProducts)
        .where(eq(promotionalOfferProducts.offerId, offer.id))
      expect(links.map((l) => l.productId).sort()).toEqual([productBId, productCId].sort())
    })

    it("normalizes the code to lowercase on insert", async () => {
      const offer = await promotionsService.createOffer(
        db,
        baseOffer({ slug: "code-offer", code: "EarlyBird-2026" }),
      )
      expect(offer.code).toBe("earlybird-2026")
    })

    it("rejects a duplicate active code (case-insensitive)", async () => {
      await promotionsService.createOffer(db, baseOffer({ slug: "first", code: "DUPLICATE" }))
      await expect(
        promotionsService.createOffer(db, baseOffer({ slug: "second", code: "duplicate" })),
      ).rejects.toThrow()
    })

    it("allows an archived offer to free its code for reuse", async () => {
      const first = await promotionsService.createOffer(
        db,
        baseOffer({ slug: "first", code: "RECYCLED" }),
      )
      await promotionsService.archiveOffer(db, first.id)
      // Re-creating with the same code on a fresh active row succeeds.
      const second = await promotionsService.createOffer(
        db,
        baseOffer({ slug: "second", code: "recycled" }),
      )
      expect(second.code).toBe("recycled")
    })
  })

  describe("updateOffer", () => {
    it("re-materializes the link table when scope changes", async () => {
      const offer = await promotionsService.createOffer(
        db,
        baseOffer({ scope: { kind: "products", productIds: [productAId] } }),
      )

      const newScope: PromotionalOfferScope = {
        kind: "products",
        productIds: [productBId, productCId],
      }
      await promotionsService.updateOffer(db, offer.id, { scope: newScope })

      const links = await db
        .select({ productId: promotionalOfferProducts.productId })
        .from(promotionalOfferProducts)
        .where(eq(promotionalOfferProducts.offerId, offer.id))
      expect(links.map((l) => l.productId).sort()).toEqual([productBId, productCId].sort())
    })

    it("does NOT emit on description-only edits", async () => {
      const offer = await promotionsService.createOffer(db, baseOffer())
      const { bus, recorded } = makeEventBus()
      await promotionsService.updateOffer(
        db,
        offer.id,
        { description: "Updated description" },
        // biome-ignore lint/suspicious/noExplicitAny: test-only narrow EventBus stub
        { eventBus: bus as any },
      )
      expect(recorded).toHaveLength(0)
    })

    it("emits with source='updated' and the old/new product union on a scope edit", async () => {
      const offer = await promotionsService.createOffer(
        db,
        baseOffer({ scope: { kind: "products", productIds: [productAId] } }),
      )
      const { bus, recorded } = makeEventBus()
      await promotionsService.updateOffer(
        db,
        offer.id,
        { scope: { kind: "products", productIds: [productBId] } },
        // biome-ignore lint/suspicious/noExplicitAny: test-only narrow EventBus stub
        { eventBus: bus as any },
      )
      expect(recorded).toHaveLength(1)
      expect(recorded[0]?.payload.source).toBe("updated")
      expect(recorded[0]?.payload.affected).toEqual({
        kind: "products",
        productIds: expect.arrayContaining([productAId, productBId]),
      })
      if (recorded[0]?.payload.affected.kind === "products") {
        expect(recorded[0].payload.affected.productIds).toHaveLength(2)
      }
    })

    it("emits affected='all' when either side of a scope edit is unbounded", async () => {
      const offer = await promotionsService.createOffer(
        db,
        baseOffer({ scope: { kind: "global" } }),
      )
      const { bus, recorded } = makeEventBus()
      await promotionsService.updateOffer(
        db,
        offer.id,
        { scope: { kind: "products", productIds: [productBId] } },
        // biome-ignore lint/suspicious/noExplicitAny: test-only narrow EventBus stub
        { eventBus: bus as any },
      )

      expect(recorded).toHaveLength(1)
      expect(recorded[0]?.payload.affected).toEqual({ kind: "all" })
    })

    it("returns null for a missing offer id", async () => {
      const result = await promotionsService.updateOffer(db, "pofr_does_not_exist", {
        name: "X",
      })
      expect(result).toBeNull()
    })
  })

  describe("archiveOffer", () => {
    it("flips active to false and emits an updated event", async () => {
      const offer = await promotionsService.createOffer(db, baseOffer())
      const { bus, recorded } = makeEventBus()
      const archived = await promotionsService.archiveOffer(db, offer.id, {
        // biome-ignore lint/suspicious/noExplicitAny: test-only narrow EventBus stub
        eventBus: bus as any,
      })
      expect(archived?.active).toBe(false)
      expect(recorded[0]?.payload.source).toBe("updated")
    })
  })

  describe("deleteOffer", () => {
    it("hard-deletes when no redemptions exist", async () => {
      const offer = await promotionsService.createOffer(db, baseOffer())
      const result = await promotionsService.deleteOffer(db, offer.id)
      expect(result).toEqual({ id: offer.id })

      const [row] = await db
        .select()
        .from(promotionalOffers)
        .where(eq(promotionalOffers.id, offer.id))
        .limit(1)
      expect(row).toBeUndefined()
    })

    it("throws when redemptions exist (FK RESTRICT pre-check)", async () => {
      const offer = await promotionsService.createOffer(db, baseOffer())
      await db.insert(promotionalOfferRedemptions).values({
        offerId: offer.id,
        bookingId: "book_test",
        discountAppliedCents: 100,
        currency: "USD",
      })

      await expect(promotionsService.deleteOffer(db, offer.id)).rejects.toThrow(
        /redemption\(s\) exist/,
      )
    })
  })

  describe("listOffers", () => {
    it("filters by active flag", async () => {
      const a = await promotionsService.createOffer(db, baseOffer({ slug: "a" }))
      await promotionsService.createOffer(db, baseOffer({ slug: "b" }))
      await promotionsService.archiveOffer(db, a.id)

      const activeOnly = await promotionsService.listOffers(db, {
        active: true,
        limit: 50,
        offset: 0,
      })
      expect(activeOnly.total).toBe(1)
      expect(activeOnly.data[0]?.slug).toBe("b")

      const archivedOnly = await promotionsService.listOffers(db, {
        active: false,
        limit: 50,
        offset: 0,
      })
      expect(archivedOnly.total).toBe(1)
      expect(archivedOnly.data[0]?.slug).toBe("a")
    })

    it("filters by code (lowercased)", async () => {
      await promotionsService.createOffer(db, baseOffer({ slug: "with-code", code: "FINDME" }))
      await promotionsService.createOffer(db, baseOffer({ slug: "without-code" }))

      const result = await promotionsService.listOffers(db, {
        code: "FindMe",
        limit: 50,
        offset: 0,
      })
      expect(result.total).toBe(1)
      expect(result.data[0]?.code).toBe("findme")
    })
  })

  describe("recomputeOfferLinks", () => {
    it("rebuilds the link table from current scope (idempotent)", async () => {
      const offer = await promotionsService.createOffer(
        db,
        baseOffer({ scope: { kind: "products", productIds: [productAId] } }),
      )
      // Run again with the same scope — link table should still match.
      await promotionsService.recomputeOfferLinks(db, offer.id, {
        kind: "products",
        productIds: [productAId],
      })
      const links = await db
        .select()
        .from(promotionalOfferProducts)
        .where(eq(promotionalOfferProducts.offerId, offer.id))
      expect(links).toHaveLength(1)
      expect(links[0]?.productId).toBe(productAId)
    })
  })
})

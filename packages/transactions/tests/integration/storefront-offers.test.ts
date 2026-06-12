import { sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  createStorefrontPromotionalOffersResolver,
  getStorefrontPromotionalOfferBySlug,
  listStorefrontPromotionalOffers,
} from "../../src/index.js"
import { offerItems, offers } from "../../src/schema.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const ORIGINAL_TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

function getIsolatedTransactionsTestDbUrl(url: string | undefined) {
  if (!url) return url

  try {
    const parsed = new URL(url)
    if (parsed.hostname === "127.0.0.1" && parsed.pathname === "/voyant_test") {
      parsed.pathname = "/voyant_transactions_test"
      return parsed.toString()
    }
  } catch {
    return url
  }

  return url
}

async function cleanupTransactionsTestData(
  // biome-ignore lint/suspicious/noExplicitAny: test db typing -- owner: transactions; existing suppression is intentional pending typed cleanup.
  db: any,
) {
  await db.execute(sql`
    TRUNCATE
      offer_items,
      offer_participants,
      offers
    CASCADE
  `)
}

describe.skipIf(!DB_AVAILABLE)("Transactions storefront promotional offers", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test db typing -- owner: transactions; existing suppression is intentional pending typed cleanup.
  let db: any

  beforeAll(async () => {
    process.env.TEST_DATABASE_URL = getIsolatedTransactionsTestDbUrl(process.env.TEST_DATABASE_URL)
    const { createTestDb } = await import("@voyantjs/db/test-utils")
    db = createTestDb()
    await cleanupTransactionsTestData(db)
  })

  beforeEach(async () => {
    await cleanupTransactionsTestData(db)
  })

  afterAll(() => {
    process.env.TEST_DATABASE_URL = ORIGINAL_TEST_DATABASE_URL
  })

  it("lists applicable storefront promotional offers from published offers", async () => {
    const [activeOffer, ignoredOffer] = await db
      .insert(offers)
      .values([
        {
          offerNumber: "OFF-STORE-0001",
          title: "Early booking",
          status: "published",
          currency: "EUR",
          metadata: {
            storefrontPromotionalOffer: {
              slug: "early-booking",
              description: "Save 15% on early departures.",
              discountType: "percentage",
              discountValue: "15",
              applicableDepartureIds: ["dep_456"],
              imageMobileUrl: "https://cdn.example.com/offers/early-mobile.png",
              imageDesktopUrl: "https://cdn.example.com/offers/early-desktop.png",
              minTravelers: 2,
              stackable: false,
            },
          },
        },
        {
          offerNumber: "OFF-STORE-0002",
          title: "Wrong product",
          status: "published",
          currency: "EUR",
          metadata: {
            storefrontPromotionalOffer: {
              slug: "wrong-product",
              discountType: "fixed_amount",
              discountValue: "200",
              applicableDepartureIds: ["dep_456"],
              stackable: true,
            },
          },
        },
      ])
      .returning()

    await db.insert(offerItems).values([
      {
        offerId: activeOffer.id,
        productId: "prod_123",
        title: "Arctic Escape",
        itemType: "discount",
        status: "priced",
        quantity: 1,
        sellCurrency: "EUR",
        totalSellAmountCents: -15000,
      },
      {
        offerId: ignoredOffer.id,
        productId: "prod_999",
        title: "Other Product",
        itemType: "discount",
        status: "priced",
        quantity: 1,
        sellCurrency: "EUR",
        totalSellAmountCents: -20000,
      },
    ])

    const rows = await listStorefrontPromotionalOffers(db, {
      productId: "prod_123",
      departureId: "dep_456",
      now: new Date("2026-04-14T00:00:00.000Z"),
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: activeOffer.id,
      name: "Early booking",
      slug: "early-booking",
      discountType: "percentage",
      discountValue: "15",
      applicableProductIds: ["prod_123"],
      applicableDepartureIds: ["dep_456"],
      minTravelers: 2,
      stackable: false,
    })
  })

  it("resolves storefront offers by slug and exposes a storefront-compatible resolver", async () => {
    const [offer] = await db
      .insert(offers)
      .values({
        offerNumber: "OFF-STORE-0003",
        title: "Flash sale",
        status: "published",
        currency: "EUR",
        validFrom: "2026-04-01",
        validUntil: "2026-04-30",
        metadata: {
          storefrontPromotionalOffer: {
            slug: "flash-sale",
            locale: "ro",
            description: "Limited time flash sale.",
            discountType: "fixed_amount",
            discountValue: "100",
            applicableProductIds: ["prod_456"],
            stackable: true,
          },
        },
      })
      .returning()

    await db.insert(offerItems).values({
      offerId: offer.id,
      productId: "prod_456",
      title: "Mediterranean Escape",
      itemType: "discount",
      status: "priced",
      quantity: 1,
      sellCurrency: "EUR",
      totalSellAmountCents: -10000,
    })

    const row = await getStorefrontPromotionalOfferBySlug(db, {
      slug: "flash-sale",
      locale: "ro",
      now: new Date("2026-04-14T00:00:00.000Z"),
    })

    expect(row).not.toBeNull()
    expect(row).toMatchObject({
      id: offer.id,
      slug: "flash-sale",
      discountType: "fixed_amount",
      discountValue: "100",
      applicableProductIds: ["prod_456"],
      stackable: true,
    })

    const resolver = createStorefrontPromotionalOffersResolver(db)
    await expect(
      resolver.listApplicableOffers({
        productId: "prod_456",
        locale: "ro",
      }),
    ).resolves.toHaveLength(1)
    await expect(
      resolver.getOfferBySlug({ slug: "flash-sale", locale: "ro" }),
    ).resolves.toMatchObject({
      id: offer.id,
      slug: "flash-sale",
    })
  })
})

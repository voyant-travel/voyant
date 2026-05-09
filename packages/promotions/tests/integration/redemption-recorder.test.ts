/**
 * Integration tests for the redemption subscriber's core function.
 *
 * Covers the aggregation rules from §3.5 + the idempotent upsert behavior:
 *   - Reads `pricing_applied_offers` from `catalog_quotes` filtered by
 *     `consumed_booking_id`.
 *   - Aggregates per-offer across multiple snapshots in the same booking
 *     (sums discount_applied_cents).
 *   - First non-null `appliedCode` wins for `code_used`.
 *   - One redemption row per (offer, booking) — verified via the unique
 *     index.
 *   - Replay-safe via ON CONFLICT DO UPDATE.
 *
 * Skips when TEST_DATABASE_URL is unset.
 */

import { type AppliedOffer, catalogQuotesTable } from "@voyantjs/catalog/booking-engine"
import { newId } from "@voyantjs/db/lib/typeid"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { beforeEach, describe, expect, it } from "vitest"

import { promotionalOfferRedemptions, promotionalOffers } from "../../src/schema.js"
import { recordPromotionRedemptionsForBooking } from "../../src/service-booking-confirmed.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const DB_AVAILABLE = !!TEST_DATABASE_URL
const db: PostgresJsDatabase = DB_AVAILABLE
  ? createTestDb()
  : (null as unknown as PostgresJsDatabase)

let bookingSeq = 0
function makeBookingId(): string {
  bookingSeq += 1
  return `book_test_${bookingSeq.toString().padStart(6, "0")}`
}

async function insertOffer(): Promise<string> {
  const id = newId("promotional_offers")
  await db.insert(promotionalOffers).values({
    id,
    name: `Test ${id}`,
    slug: `slug-${id.slice(-8)}`,
    discountType: "percentage",
    discountPercent: "10",
    scope: { kind: "global" },
    conditions: {},
    active: true,
  })
  return id
}

async function insertQuote(bookingId: string, appliedOffers: AppliedOffer[] | null): Promise<void> {
  await db.insert(catalogQuotesTable).values({
    id: newId("catalog_quotes"),
    entity_module: "products",
    entity_id: "prod_x",
    source_kind: "owned",
    available: true,
    locale: "en-GB",
    audience: "customer",
    market: "default",
    currency: "USD",
    pricing_base_amount: "10000",
    pricing_currency: "USD",
    pricing_applied_offers: appliedOffers ?? undefined,
    consumed_booking_id: bookingId,
    consumed_at: new Date(),
    expires_at: new Date(Date.now() + 60_000),
  })
}

function makeAppliedOffer(offerId: string, overrides: Partial<AppliedOffer> = {}): AppliedOffer {
  return {
    offerId,
    offerName: `Offer ${offerId}`,
    discountAppliedCents: 100,
    discountedPriceCents: 9900,
    currency: "USD",
    discountKind: "percentage",
    discountPercent: 10,
    discountAmountCents: null,
    appliedCode: null,
    stackable: false,
    ...overrides,
  }
}

describe.skipIf(!DB_AVAILABLE)("recordPromotionRedemptionsForBooking", () => {
  beforeEach(async () => {
    await cleanupTestDb(db)
  })

  it("returns zeros + writes nothing when the booking has no consumed quotes", async () => {
    const result = await recordPromotionRedemptionsForBooking(db, makeBookingId())
    expect(result).toEqual({ quotesScanned: 0, offersFound: 0, rowsUpserted: 0 })
    const rows = await db.select().from(promotionalOfferRedemptions)
    expect(rows).toEqual([])
  })

  it("returns zero offers when consumed quotes have empty pricing_applied_offers", async () => {
    const bookingId = makeBookingId()
    await insertQuote(bookingId, null)
    const result = await recordPromotionRedemptionsForBooking(db, bookingId)
    expect(result).toEqual({ quotesScanned: 1, offersFound: 0, rowsUpserted: 0 })
  })

  it("inserts one redemption row per applied offer on a single-quote booking", async () => {
    const bookingId = makeBookingId()
    const offerA = await insertOffer()
    const offerB = await insertOffer()
    await insertQuote(bookingId, [
      makeAppliedOffer(offerA, { discountAppliedCents: 200 }),
      makeAppliedOffer(offerB, { discountAppliedCents: 300, appliedCode: "EARLY" }),
    ])

    const result = await recordPromotionRedemptionsForBooking(db, bookingId)
    expect(result).toEqual({ quotesScanned: 1, offersFound: 2, rowsUpserted: 2 })

    const rows = await db
      .select()
      .from(promotionalOfferRedemptions)
      .where(eq(promotionalOfferRedemptions.bookingId, bookingId))
    expect(rows).toHaveLength(2)
    const byOffer = new Map(rows.map((r) => [r.offerId, r]))
    expect(byOffer.get(offerA)?.discountAppliedCents).toBe(200)
    expect(byOffer.get(offerA)?.codeUsed).toBeNull()
    expect(byOffer.get(offerB)?.discountAppliedCents).toBe(300)
    expect(byOffer.get(offerB)?.codeUsed).toBe("EARLY")
  })

  it("aggregates the same offer across multiple snapshots — one row, summed cents", async () => {
    const bookingId = makeBookingId()
    const offer = await insertOffer()
    await insertQuote(bookingId, [makeAppliedOffer(offer, { discountAppliedCents: 100 })])
    await insertQuote(bookingId, [makeAppliedOffer(offer, { discountAppliedCents: 250 })])
    await insertQuote(bookingId, [makeAppliedOffer(offer, { discountAppliedCents: 50 })])

    const result = await recordPromotionRedemptionsForBooking(db, bookingId)
    expect(result).toEqual({ quotesScanned: 3, offersFound: 1, rowsUpserted: 1 })

    const rows = await db
      .select()
      .from(promotionalOfferRedemptions)
      .where(eq(promotionalOfferRedemptions.bookingId, bookingId))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.discountAppliedCents).toBe(400)
  })

  it("first non-null appliedCode wins for code_used during aggregation", async () => {
    const bookingId = makeBookingId()
    const offer = await insertOffer()
    await insertQuote(bookingId, [makeAppliedOffer(offer, { appliedCode: null })])
    await insertQuote(bookingId, [makeAppliedOffer(offer, { appliedCode: "FOUND" })])
    await insertQuote(bookingId, [makeAppliedOffer(offer, { appliedCode: "OTHER" })])

    await recordPromotionRedemptionsForBooking(db, bookingId)

    const rows = await db
      .select()
      .from(promotionalOfferRedemptions)
      .where(eq(promotionalOfferRedemptions.bookingId, bookingId))
    expect(rows[0]?.codeUsed).toBe("FOUND")
  })

  it("is idempotent on retry — re-running the recorder with the same data leaves a single row", async () => {
    const bookingId = makeBookingId()
    const offer = await insertOffer()
    await insertQuote(bookingId, [makeAppliedOffer(offer, { discountAppliedCents: 100 })])

    await recordPromotionRedemptionsForBooking(db, bookingId)
    await recordPromotionRedemptionsForBooking(db, bookingId)
    await recordPromotionRedemptionsForBooking(db, bookingId)

    const rows = await db
      .select()
      .from(promotionalOfferRedemptions)
      .where(eq(promotionalOfferRedemptions.bookingId, bookingId))
    expect(rows).toHaveLength(1) // unique constraint enforces this
    expect(rows[0]?.discountAppliedCents).toBe(100)
  })

  it("upsert refreshes discount_applied_cents AND code_used when re-aggregation produces new values", async () => {
    // Regression test for the codex P2 — the prior `set: { col: table.col }`
    // form was a no-op. This test inserts one quote, runs the recorder
    // (creates the redemption row), then mutates the quote's applied-offer
    // payload to simulate a stale prior write being corrected, then runs
    // the recorder again. The row must reflect the freshly-computed values.
    const bookingId = makeBookingId()
    const offer = await insertOffer()

    // First pass: discount = 100, no code.
    await insertQuote(bookingId, [
      makeAppliedOffer(offer, { discountAppliedCents: 100, appliedCode: null }),
    ])
    await recordPromotionRedemptionsForBooking(db, bookingId)

    // Wipe + re-seed the quote with different values. Mirrors a stale
    // prior subscriber attempt being corrected on replay.
    await cleanupTestDb(db)
    // cleanupTestDb wiped offers + redemptions too; re-create both.
    await db.insert(promotionalOffers).values({
      id: offer,
      name: `Test ${offer}`,
      slug: `slug-${offer.slice(-8)}`,
      discountType: "percentage",
      discountPercent: "10",
      scope: { kind: "global" },
      conditions: {},
      active: true,
    })
    await insertQuote(bookingId, [
      makeAppliedOffer(offer, { discountAppliedCents: 250, appliedCode: "REFRESHED" }),
    ])
    // Pre-create the prior (stale) redemption row so we test the UPDATE branch.
    await db.insert(promotionalOfferRedemptions).values({
      offerId: offer,
      bookingId,
      discountAppliedCents: 100,
      currency: "USD",
      codeUsed: null,
    })

    await recordPromotionRedemptionsForBooking(db, bookingId)

    const rows = await db
      .select()
      .from(promotionalOfferRedemptions)
      .where(eq(promotionalOfferRedemptions.bookingId, bookingId))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.discountAppliedCents).toBe(250)
    expect(rows[0]?.codeUsed).toBe("REFRESHED")
  })
})

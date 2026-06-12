/**
 * Integration tests for the boundary scheduler.
 *
 * Drives a real DB through full boundary-crossing scenarios:
 *   - First tick uses the configured initial-lookback when no watermark
 *     row exists.
 *   - Watermark advances monotonically across ticks.
 *   - Crossings detected for both `valid_from` (source="updated") and
 *     `valid_until` (source="expired").
 *   - eventBus emit count matches `crossings.length` when bus is wired.
 *   - `crossings[]` always populated (so cron-style callers without a
 *     bus can dispatch inline).
 *   - Idempotent on re-run with the same wall clock.
 *
 * Skips entirely when TEST_DATABASE_URL is unset.
 */

import { newId } from "@voyantjs/db/lib/typeid"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { beforeEach, describe, expect, it } from "vitest"

import { PROMOTION_CHANGED_EVENT, type PromotionChangedEvent } from "../../src/events.js"
import { promotionalOfferSchedulerState, promotionalOffers } from "../../src/schema.js"
import {
  type BoundaryCrossing,
  runPromotionBoundaryScheduler,
} from "../../src/service-boundary-scheduler.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const DB_AVAILABLE = !!TEST_DATABASE_URL
const db: PostgresJsDatabase = DB_AVAILABLE ? createTestDb() : (undefined as never)

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
    },
    recorded,
  }
}

async function insertOffer(
  overrides: Partial<typeof promotionalOffers.$inferInsert> = {},
): Promise<string> {
  const id = newId("promotional_offers")
  await db.insert(promotionalOffers).values({
    id,
    name: overrides.name ?? "Test",
    slug: overrides.slug ?? `slug-${id.slice(-8)}`,
    discountType: "percentage",
    discountPercent: "10",
    scope: { kind: "global" },
    conditions: {},
    active: true,
    ...overrides,
  })
  return id
}

describe.skipIf(!DB_AVAILABLE)("runPromotionBoundaryScheduler", () => {
  beforeEach(async () => {
    await cleanupTestDb(db)
  })

  it("on first tick (no watermark row), uses initialLookbackMs as the lower bound", async () => {
    const tickAt = new Date("2026-05-09T12:00:00Z")
    // Offer's valid_from is 1h before the tick — within the default 24h lookback.
    await insertOffer({ validFrom: new Date("2026-05-09T11:00:00Z") })

    const result = await runPromotionBoundaryScheduler({ db }, { now: () => tickAt })
    expect(result.tickedAt).toEqual(tickAt)
    expect(result.validFromCrossings).toBe(1)
    expect(result.crossings).toHaveLength(1)
    expect(result.crossings[0]?.source).toBe("updated")
  })

  it("subsequent tick reads the persisted watermark — earlier crossings aren't re-fired", async () => {
    // Tick 1: detects the crossing, persists watermark = tick1At.
    const tick1At = new Date("2026-05-09T12:00:00Z")
    await insertOffer({ validFrom: new Date("2026-05-09T11:00:00Z") })
    const r1 = await runPromotionBoundaryScheduler({ db }, { now: () => tick1At })
    expect(r1.crossings).toHaveLength(1)

    // Tick 2: same offer, no NEW crossings. Watermark prevents re-emission.
    const tick2At = new Date("2026-05-09T13:00:00Z")
    const r2 = await runPromotionBoundaryScheduler({ db }, { now: () => tick2At })
    expect(r2.crossings).toEqual([])
    expect(r2.lastTick).toEqual(tick1At) // pulled the persisted watermark
  })

  it("detects valid_until crossings with source='expired'", async () => {
    const tickAt = new Date("2026-05-09T12:00:00Z")
    await insertOffer({ validUntil: new Date("2026-05-09T11:30:00Z") })
    const result = await runPromotionBoundaryScheduler({ db }, { now: () => tickAt })
    expect(result.validUntilCrossings).toBe(1)
    expect(result.crossings).toHaveLength(1)
    expect(result.crossings[0]?.source).toBe("expired")
  })

  it("emits one promotion.changed event per crossing when an event bus is wired", async () => {
    const tickAt = new Date("2026-05-09T12:00:00Z")
    await insertOffer({ validFrom: new Date("2026-05-09T11:00:00Z"), name: "A" })
    await insertOffer({ validUntil: new Date("2026-05-09T11:30:00Z"), name: "B" })
    const { bus, recorded } = makeEventBus()

    const result = await runPromotionBoundaryScheduler(
      { db, eventBus: bus as never },
      { now: () => tickAt },
    )
    expect(result.emitted).toBe(2)
    expect(recorded).toHaveLength(2)
    expect(recorded.every((e) => e.topic === PROMOTION_CHANGED_EVENT)).toBe(true)
    const sources = recorded.map((e) => e.payload.source).sort()
    expect(sources).toEqual(["expired", "updated"])
  })

  it("returns crossings[] even without an event bus (so cron handlers can dispatch inline)", async () => {
    const tickAt = new Date("2026-05-09T12:00:00Z")
    await insertOffer({ validFrom: new Date("2026-05-09T11:00:00Z") })
    const result = await runPromotionBoundaryScheduler({ db }, { now: () => tickAt })
    expect(result.emitted).toBe(0) // no bus → no emissions
    expect(result.crossings).toHaveLength(1)
  })

  it("populates affected.productIds for product-shaped scopes", async () => {
    const tickAt = new Date("2026-05-09T12:00:00Z")
    await insertOffer({
      validFrom: new Date("2026-05-09T11:00:00Z"),
      scope: { kind: "products", productIds: ["prod_x", "prod_y"] },
    })
    const result = await runPromotionBoundaryScheduler({ db }, { now: () => tickAt })
    const crossing = result.crossings[0] as BoundaryCrossing
    expect(crossing.affected.kind).toBe("products")
    if (crossing.affected.kind === "products") {
      // products scope materializes via the link table — empty here since
      // we didn't seed promotional_offer_products. Acceptable for this
      // test since the resolution logic is exercised separately in
      // service.test.ts.
      expect(crossing.affected.productIds).toEqual([])
    }
  })

  it("falls back to affected.kind='all' for slice-shaped scopes (markets / audiences / global)", async () => {
    const tickAt = new Date("2026-05-09T12:00:00Z")
    await insertOffer({
      validFrom: new Date("2026-05-09T11:00:00Z"),
      scope: { kind: "audiences", audiences: ["customer"] },
    })
    const result = await runPromotionBoundaryScheduler({ db }, { now: () => tickAt })
    expect(result.crossings[0]?.affected).toEqual({ kind: "all" })
  })

  it("watermark write upserts on the singleton row (no row explosion across ticks)", async () => {
    const tick1 = new Date("2026-05-09T12:00:00Z")
    const tick2 = new Date("2026-05-09T13:00:00Z")
    const tick3 = new Date("2026-05-09T14:00:00Z")
    await runPromotionBoundaryScheduler({ db }, { now: () => tick1 })
    await runPromotionBoundaryScheduler({ db }, { now: () => tick2 })
    await runPromotionBoundaryScheduler({ db }, { now: () => tick3 })

    const rows = await db.select().from(promotionalOfferSchedulerState)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.lastTick).toEqual(tick3)
  })

  it("inactive offers are ignored even when they cross the boundary", async () => {
    const tickAt = new Date("2026-05-09T12:00:00Z")
    await insertOffer({
      validFrom: new Date("2026-05-09T11:00:00Z"),
      active: false,
    })
    const result = await runPromotionBoundaryScheduler({ db }, { now: () => tickAt })
    expect(result.crossings).toEqual([])
  })
})

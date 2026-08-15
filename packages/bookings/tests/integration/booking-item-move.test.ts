/**
 * `item_move` Amendments: carrying a Booking Item to a different departure.
 *
 * The invariant is that capacity is conserved across the move — the old
 * departure gets its seats back, the new one gives up exactly as many, and
 * a target that cannot seat the booking is refused rather than oversold.
 * These assert on both slot rows, because a move that updates the item and
 * forgets one side of the capacity looks perfectly healthy from the API.
 */

import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { availabilitySlotsRef } from "../../src/availability-ref.js"
import { optionPriceRulesRef, priceCatalogsRef } from "../../src/pricing-ref.js"
import { productOptionsRef, productsRef } from "../../src/products-ref.js"
import type { BookingsFinanceRuntime } from "../../src/runtime-port.js"
import { bookingAllocations, bookingItems, bookings } from "../../src/schema.js"
import { bookingAmendmentService } from "../../src/service-amendments.js"

const DB_AVAILABLE = Boolean(process.env.TEST_DATABASE_URL)

describe.skipIf(!DB_AVAILABLE)("Booking item move Amendments", () => {
  let db: ReturnType<typeof import("@voyant-travel/db/test-utils").createTestDb>
  let sequence = 0
  const recorded: Array<{ refundHandling?: string; feeDeltaCents: number }> = []

  beforeAll(async () => {
    const { cleanupTestDb, createTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
    recorded.length = 0
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  /**
   * Passes fares through untaxed and records what it was asked to settle,
   * so the tests can assert the operator's choice actually reaches finance.
   */
  function financeRuntime(): BookingsFinanceRuntime {
    return {
      async quoteBookingAmendment(_db, input) {
        const feeDeltaCents = input.feeDeltaCents ?? 0
        const amountCents =
          input.lines.reduce((sum, line) => sum + line.subtotalDeltaCents, 0) + feeDeltaCents
        return {
          price: {
            currency: input.currency,
            subtotalDeltaCents: input.lines.reduce((s, l) => s + l.subtotalDeltaCents, 0),
            feeDeltaCents,
            taxDeltaCents: 0,
            amountCents,
            collectionAmountCents: Math.max(amountCents, 0),
            refundAmountCents: Math.max(-amountCents, 0),
            taxLines: [],
          },
          consequences: {
            collection: amountCents > 0 ? "required" : "not_required",
            refund: amountCents < 0 ? "required" : "not_required",
            invoice: amountCents > 0 ? "reissue_required" : "not_required",
            creditNote: amountCents < 0 ? "issue_required" : "not_required",
            paymentSchedule: amountCents === 0 ? "not_required" : "recalculate_required",
          },
          policyVersion: "test-finance-v1",
        }
      },
      async recordBookingAmendment(_tx, input) {
        recorded.push({
          refundHandling: input.refundHandling,
          feeDeltaCents: input.price.feeDeltaCents,
        })
        return { adjustmentId: "faad_test", status: "recorded" }
      },
    }
  }

  async function seedSlot(
    productId: string,
    options: { remainingPax: number; dateLocal: string; startsAt: string },
  ) {
    const [slot] = await db
      .insert(availabilitySlotsRef)
      .values({
        productId,
        dateLocal: options.dateLocal,
        startsAt: new Date(options.startsAt),
        timezone: "Europe/Bucharest",
        status: "open",
        unlimited: false,
        initialPax: options.remainingPax,
        remainingPax: options.remainingPax,
      })
      .returning()
    return slot!
  }

  /** A confirmed booking of `quantity` seats on `from`, with `to` available. */
  async function seed(
    options: {
      quantity?: number
      unitPrice?: number
      targetPrice?: number
      targetPax?: number
    } = {},
  ) {
    sequence += 1
    const quantity = options.quantity ?? 2
    const unitPrice = options.unitPrice ?? 10_000

    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: `BK-MOVE-${String(sequence).padStart(6, "0")}`,
        sellCurrency: "EUR",
        status: "confirmed",
        sellAmountCents: unitPrice * quantity,
      })
      .returning()

    const [catalog] = await db
      .insert(priceCatalogsRef)
      .values({
        code: `PUB-MOVE-${sequence}`,
        name: "Public",
        currencyCode: "EUR",
        catalogType: "public",
        isDefault: true,
        active: true,
      })
      .returning()

    const [product] = await db
      .insert(productsRef)
      .values({
        name: "Istanbul 7 days",
        status: "active",
        visibility: "public",
        activated: true,
        sellCurrency: "EUR",
        sellAmountCents: unitPrice,
      })
      .returning()

    const [option] = await db
      .insert(productOptionsRef)
      .values({ productId: product!.id, name: "Standard", status: "active", isDefault: true })
      .returning()

    await db.insert(optionPriceRulesRef).values({
      productId: product!.id,
      optionId: option!.id,
      priceCatalogId: catalog!.id,
      name: "Default",
      pricingMode: "per_person",
      baseSellAmountCents: options.targetPrice ?? unitPrice,
      isDefault: true,
      active: true,
    })

    const from = await seedSlot(product!.id, {
      remainingPax: 0,
      dateLocal: "2026-09-10",
      startsAt: "2026-09-10T08:00:00.000Z",
    })
    const to = await seedSlot(product!.id, {
      remainingPax: options.targetPax ?? 8,
      dateLocal: "2026-10-15",
      startsAt: "2026-10-15T08:00:00.000Z",
    })

    const [item] = await db
      .insert(bookingItems)
      .values({
        bookingId: booking!.id,
        title: "Istanbul 7 days",
        status: "confirmed",
        quantity,
        sellCurrency: "EUR",
        unitSellAmountCents: unitPrice,
        totalSellAmountCents: unitPrice * quantity,
        productId: product!.id,
        optionId: option!.id,
        availabilitySlotId: from.id,
      })
      .returning()

    const [allocation] = await db
      .insert(bookingAllocations)
      .values({
        bookingId: booking!.id,
        bookingItemId: item!.id,
        productId: product!.id,
        availabilitySlotId: from.id,
        quantity,
        status: "confirmed",
      })
      .returning()

    return {
      booking: booking!,
      product: product!,
      option: option!,
      from,
      to,
      item: item!,
      allocation: allocation!,
    }
  }

  function context(key: string) {
    return { actor: "staff" as const, actorId: "usr_staff", idempotencyKey: key }
  }

  async function previewMove(
    seeded: Awaited<ReturnType<typeof seed>>,
    overrides: {
      slotId?: string
      changeFeeCents?: number
      refundHandling?: "refund" | "travel_credit" | "waive"
      key?: string
    } = {},
  ) {
    return bookingAmendmentService.previewItemMove(
      db,
      seeded.booking.id,
      {
        expectedBookingRevision: 1,
        reason: "Customer asked to travel a month later",
        move: {
          type: "item_move",
          bookingItemId: seeded.item.id,
          availabilitySlotId: overrides.slotId ?? seeded.to.id,
          changeFeeCents: overrides.changeFeeCents ?? 0,
          refundHandling: overrides.refundHandling ?? "refund",
        },
      },
      context(overrides.key ?? "preview-move-1"),
      { finance: financeRuntime() },
    )
  }

  async function applyMove(
    amendment: { id: string; revisions?: Array<{ id: string; role: string }> },
    key: string,
  ) {
    const proposed = amendment.revisions?.find((r) => r.role === "proposed_after")
    if (!proposed) throw new Error("Expected a proposed revision")
    await bookingAmendmentService.accept(db, amendment.id, proposed.id, context(`${key}-accept`), {
      finance: financeRuntime(),
    })
    return bookingAmendmentService.apply(
      db,
      amendment.id,
      { expectedBookingRevision: 1, proposedRevisionId: proposed.id },
      context(key),
      { finance: financeRuntime() },
    )
  }

  async function readSlot(slotId: string) {
    const [row] = await db
      .select()
      .from(availabilitySlotsRef)
      .where(eq(availabilitySlotsRef.id, slotId))
    return row
  }

  it("quotes the target date's fare plus the operator's change fee", async () => {
    const seeded = await seed({ quantity: 2, unitPrice: 10_000, targetPrice: 12_000 })
    const preview = await previewMove(seeded, { changeFeeCents: 3_000 })

    expect(preview.status).toBe("ok")
    if (preview.status !== "ok") throw new Error("Expected a quote")
    expect(preview.amendment).toMatchObject({
      kind: "item_move",
      travelerId: null,
      priceDelta: {
        // (12_000 - 10_000) x 2 seats = 4_000 fare, + 3_000 fee
        subtotalDeltaCents: 4_000,
        feeDeltaCents: 3_000,
        amountCents: 7_000,
        collectionAmountCents: 7_000,
      },
      effects: { allocation: "move_required", documents: "reissue_required" },
    })
  })

  it("conserves capacity across both departures on apply", async () => {
    const seeded = await seed({ quantity: 2, targetPax: 8 })
    const preview = await previewMove(seeded)
    if (preview.status !== "ok") throw new Error("Expected a quote")

    const applied = await applyMove(preview.amendment, "apply-move-1")
    expect(applied.status).toBe("ok")

    // Old departure gets its two seats back and reopens; new one gives up two.
    expect(await readSlot(seeded.from.id)).toMatchObject({ remainingPax: 2, status: "open" })
    expect((await readSlot(seeded.to.id))?.remainingPax).toBe(6)

    const [item] = await db.select().from(bookingItems).where(eq(bookingItems.id, seeded.item.id))
    expect(item).toMatchObject({
      availabilitySlotId: seeded.to.id,
      serviceDate: "2026-10-15",
    })

    const [allocation] = await db
      .select()
      .from(bookingAllocations)
      .where(eq(bookingAllocations.id, seeded.allocation.id))
    expect(allocation?.availabilitySlotId).toBe(seeded.to.id)
  })

  it("refuses a departure that cannot seat the booking", async () => {
    const seeded = await seed({ quantity: 4, targetPax: 1 })
    expect((await previewMove(seeded)).status).toBe("availability_changed")
  })

  it("refuses a departure belonging to a different product", async () => {
    const seeded = await seed()
    const other = await seed()

    const preview = await previewMove(seeded, { slotId: other.to.id, key: "cross-product-move" })

    expect(preview.status).toBe("not_found")
    expect((await readSlot(other.to.id))?.remainingPax).toBe(8)
  })

  it("refuses moving onto the departure it is already on", async () => {
    const seeded = await seed()
    const preview = await previewMove(seeded, { slotId: seeded.from.id })
    expect(preview.status).toBe("unsupported_configuration")
  })

  it("rolls the whole move back when the target fills up between quote and apply", async () => {
    const seeded = await seed({ quantity: 2, targetPax: 2 })
    const preview = await previewMove(seeded)
    if (preview.status !== "ok") throw new Error("Expected a quote")

    await db
      .update(availabilitySlotsRef)
      .set({ remainingPax: 0, status: "sold_out" })
      .where(eq(availabilitySlotsRef.id, seeded.to.id))

    const applied = await applyMove(preview.amendment, "apply-move-race")
    expect(applied.status).toBe("availability_changed")

    // Neither side moved: the booking still holds its original departure.
    const [item] = await db.select().from(bookingItems).where(eq(bookingItems.id, seeded.item.id))
    expect(item?.availabilitySlotId).toBe(seeded.from.id)
    expect((await readSlot(seeded.from.id))?.remainingPax).toBe(0)
  })

  it("floors a cheaper move at zero when the operator waives the difference", async () => {
    const seeded = await seed({ quantity: 2, unitPrice: 10_000, targetPrice: 6_000 })
    const preview = await previewMove(seeded, { refundHandling: "waive" })

    if (preview.status !== "ok") throw new Error("Expected a quote")
    expect(preview.amendment.priceDelta).toMatchObject({
      amountCents: 0,
      refundAmountCents: 0,
      collectionAmountCents: 0,
    })
  })

  it("keeps the change fee payable when a waived move is otherwise cheaper", async () => {
    const seeded = await seed({ quantity: 2, unitPrice: 10_000, targetPrice: 6_000 })
    const preview = await previewMove(seeded, { refundHandling: "waive", changeFeeCents: 2_500 })

    if (preview.status !== "ok") throw new Error("Expected a quote")
    expect(preview.amendment.priceDelta).toMatchObject({
      amountCents: 2_500,
      collectionAmountCents: 2_500,
      refundAmountCents: 0,
    })
  })

  it("records money owed back when the operator refunds it", async () => {
    const seeded = await seed({ quantity: 2, unitPrice: 10_000, targetPrice: 6_000 })
    const preview = await previewMove(seeded, { refundHandling: "refund" })

    if (preview.status !== "ok") throw new Error("Expected a quote")
    expect(preview.amendment.priceDelta.refundAmountCents).toBe(8_000)
  })

  it("carries the operator's settlement choice through to finance", async () => {
    const seeded = await seed({ quantity: 2, unitPrice: 10_000, targetPrice: 6_000 })
    const preview = await previewMove(seeded, { refundHandling: "travel_credit" })
    if (preview.status !== "ok") throw new Error("Expected a quote")

    await applyMove(preview.amendment, "apply-move-credit")

    expect(recorded.at(-1)).toMatchObject({ refundHandling: "travel_credit" })
  })

  it("replays an identical preview instead of quoting twice", async () => {
    const seeded = await seed()
    const first = await previewMove(seeded, { key: "same-move-key" })
    const second = await previewMove(seeded, { key: "same-move-key" })
    if (first.status !== "ok" || second.status !== "ok") throw new Error("Expected quotes")
    expect(second.amendment.id).toBe(first.amendment.id)
  })

  it("rejects a reused key that describes a different move", async () => {
    const seeded = await seed()
    await previewMove(seeded, { key: "shared-move-key", changeFeeCents: 0 })
    const conflicting = await previewMove(seeded, {
      key: "shared-move-key",
      changeFeeCents: 5_000,
    })
    expect(conflicting.status).toBe("idempotency_conflict")
  })
})

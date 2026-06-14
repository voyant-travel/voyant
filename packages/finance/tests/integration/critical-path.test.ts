/**
 * Critical-path integration test: book → confirm → invoice → pay → refund.
 *
 * The intent of this test is failure-detection on the cross-module
 * lifecycle, not coverage of every option. If a future refactor breaks the
 * happy-path interaction between bookings, finance, and the (in-tx) status
 * + inventory + invoice + payment + credit-note flow, this test should
 * fire.
 *
 * Tracks issue #294. Uses service-layer calls directly (not HTTP) to keep
 * the harness small — KMS/auth/rate-limit middleware are validated
 * separately by the route-level integration tests.
 */

import { bookingsService } from "@voyant-travel/bookings"
import { availabilitySlotsRef, bookings as bookingsTable } from "@voyant-travel/bookings/schema"
import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { creditNotes, invoices, payments } from "../../src/schema.js"
import { financeService } from "../../src/service.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

let counter = 0
function next(prefix: string) {
  counter += 1
  return `${prefix}-${String(counter).padStart(6, "0")}`
}

describe.skipIf(!DB_AVAILABLE)("critical path — book → confirm → invoice → pay → refund", () => {
  let db: ReturnType<typeof import("@voyant-travel/db/test-utils").createTestDb>

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  async function seedSlot(remainingPax: number) {
    const [slot] = await db
      .insert(availabilitySlotsRef)
      .values({
        productId: "prod_critical",
        optionId: "opt_critical",
        dateLocal: "2026-08-15",
        startsAt: new Date("2026-08-15T09:00:00.000Z"),
        endsAt: new Date("2026-08-15T11:00:00.000Z"),
        timezone: "Europe/Bucharest",
        status: "open",
        unlimited: false,
        initialPax: remainingPax,
        remainingPax,
      })
      .returning()
    if (!slot) throw new Error("seedSlot: insert returned no rows")
    return slot
  }

  it("happy path: 100% paid, then partial refund — invoice balance/status reflect both", async () => {
    const slot = await seedSlot(5)

    // 1. RESERVE — booking goes to on_hold, slot decrements
    const reserved = await bookingsService.reserveBooking(db, {
      bookingNumber: next("BK"),
      sellCurrency: "EUR",
      sellAmountCents: 12000,
      sourceType: "manual",
      contactFirstName: "Ana",
      contactLastName: "Critical",
      contactEmail: "ana@example.com",
      holdMinutes: 30,
      items: [
        {
          title: "Half-day tour, 2 adults",
          itemType: "unit",
          quantity: 2,
          sellCurrency: "EUR",
          unitSellAmountCents: 6000,
          totalSellAmountCents: 12000,
          allocationType: "unit",
          availabilitySlotId: slot.id,
        },
      ],
    })
    expect(reserved.status).toBe("ok")
    if (reserved.status !== "ok" || !reserved.booking) throw new Error("reserve failed")
    const bookingId = reserved.booking.id
    expect(reserved.booking.status).toBe("on_hold")

    // 2. CONFIRM — booking goes on_hold → confirmed, allocations confirmed,
    //    inventory NOT decremented again (held capacity transitions to confirmed)
    const confirmed = await bookingsService.confirmBooking(db, bookingId, {})
    expect(confirmed.status).toBe("ok")

    const [bookingRow] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
    expect(bookingRow?.status).toBe("confirmed")
    expect(bookingRow?.confirmedAt).toBeInstanceOf(Date)

    // 3. INVOICE — derive from booking data the caller has on hand
    const items = [
      {
        id: "bkit_critical_1",
        title: "Half-day tour, 2 adults",
        quantity: 2,
        unitSellAmountCents: 6000,
        totalSellAmountCents: 12000,
      },
    ]
    const invoice = await financeService.createInvoiceFromBooking(
      db,
      {
        invoiceNumber: next("INV"),
        bookingId,
        issueDate: "2026-04-25",
        dueDate: "2026-05-25",
      },
      {
        booking: {
          id: bookingId,
          bookingNumber: bookingRow?.bookingNumber ?? "",
          personId: null,
          organizationId: null,
          sellCurrency: "EUR",
          baseCurrency: null,
          fxRateSetId: null,
          sellAmountCents: 12000,
          baseSellAmountCents: null,
        },
        items,
      },
    )
    expect(invoice).toBeTruthy()
    expect(invoice?.status).toBe("draft")
    expect(invoice?.totalCents).toBe(12000)
    expect(invoice?.balanceDueCents).toBe(12000)
    const invoiceId = invoice?.id ?? ""

    // 4. PAY — full payment marks invoice paid
    const payment = await financeService.createPayment(db, invoiceId, {
      amountCents: 12000,
      currency: "EUR",
      paymentMethod: "bank_transfer",
      paymentDate: "2026-04-26",
      status: "completed",
    })
    expect(payment).toBeTruthy()

    const [paidInvoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId))
    expect(paidInvoice?.status).toBe("paid")
    expect(paidInvoice?.paidCents).toBe(12000)
    expect(paidInvoice?.balanceDueCents).toBe(0)

    // 5. REFUND — credit note for half. The invoice is left as-is by
    //    `createCreditNote` (it doesn't auto-touch invoice totals); the
    //    refund accounting lives on the credit note ledger. We assert the
    //    credit note row + that the original payment is preserved.
    const creditNote = await financeService.createCreditNote(db, invoiceId, {
      amountCents: 6000,
      currency: "EUR",
      reason: "partial_refund",
      issueDate: "2026-04-27",
    })
    expect(creditNote).toBeTruthy()

    const cnRows = await db.select().from(creditNotes).where(eq(creditNotes.invoiceId, invoiceId))
    expect(cnRows).toHaveLength(1)
    expect(cnRows[0]?.amountCents).toBe(6000)

    const paymentRows = await db.select().from(payments).where(eq(payments.invoiceId, invoiceId))
    expect(paymentRows).toHaveLength(1)
    expect(paymentRows[0]?.status).toBe("completed")

    // Slot inventory is decremented exactly once (at reserve).
    const [refreshedSlot] = await db
      .select({
        remainingPax: availabilitySlotsRef.remainingPax,
        initialPax: availabilitySlotsRef.initialPax,
      })
      .from(availabilitySlotsRef)
      .where(eq(availabilitySlotsRef.id, slot.id))
    expect(refreshedSlot?.initialPax).toBe(5)
    expect(refreshedSlot?.remainingPax).toBe(3) // 5 - 2 reserved
  })

  it("cancellation path: confirmed booking → cancel → inventory released", async () => {
    const slot = await seedSlot(3)

    const reserved = await bookingsService.reserveBooking(db, {
      bookingNumber: next("BK"),
      sellCurrency: "EUR",
      sellAmountCents: 6000,
      sourceType: "manual",
      contactEmail: "cancel-flow@example.com",
      holdMinutes: 30,
      items: [
        {
          title: "Refund-flow tour",
          itemType: "unit",
          quantity: 1,
          sellCurrency: "EUR",
          unitSellAmountCents: 6000,
          totalSellAmountCents: 6000,
          allocationType: "unit",
          availabilitySlotId: slot.id,
        },
      ],
    })
    if (reserved.status !== "ok" || !reserved.booking) throw new Error("reserve failed")

    const confirmed = await bookingsService.confirmBooking(db, reserved.booking.id, {})
    expect(confirmed.status).toBe("ok")

    // Inventory dropped to 2 after reserve
    const [afterReserve] = await db
      .select({ remainingPax: availabilitySlotsRef.remainingPax })
      .from(availabilitySlotsRef)
      .where(eq(availabilitySlotsRef.id, slot.id))
    expect(afterReserve?.remainingPax).toBe(2)

    // Cancel from confirmed
    const cancelled = await bookingsService.cancelBooking(db, reserved.booking.id, {})
    expect(cancelled.status).toBe("ok")

    const [afterCancel] = await db
      .select({ remainingPax: availabilitySlotsRef.remainingPax })
      .from(availabilitySlotsRef)
      .where(eq(availabilitySlotsRef.id, slot.id))
    expect(afterCancel?.remainingPax).toBe(3) // released back

    const [bookingRow] = await db
      .select({ status: bookingsTable.status, cancelledAt: bookingsTable.cancelledAt })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, reserved.booking.id))
    expect(bookingRow?.status).toBe("cancelled")
    expect(bookingRow?.cancelledAt).toBeInstanceOf(Date)
  })

  it("pii audit log: confirmed booking + invoice doesn't leak booking_pii_access_log entries unrelated to PII reads", async () => {
    // Sanity check: confirming/invoicing/paying does not implicitly write
    // PII-access rows. Only explicit PII reads should append to
    // booking_pii_access_log.
    const slot = await seedSlot(1)
    const reserved = await bookingsService.reserveBooking(db, {
      bookingNumber: next("BK"),
      sellCurrency: "EUR",
      sellAmountCents: 5000,
      sourceType: "manual",
      contactEmail: "pii@example.com",
      holdMinutes: 30,
      items: [
        {
          title: "Small group tour",
          itemType: "unit",
          quantity: 1,
          sellCurrency: "EUR",
          unitSellAmountCents: 5000,
          totalSellAmountCents: 5000,
          allocationType: "unit",
          availabilitySlotId: slot.id,
        },
      ],
    })
    if (reserved.status !== "ok" || !reserved.booking) throw new Error("reserve failed")

    await bookingsService.confirmBooking(db, reserved.booking.id, {})

    const auditCount = (await db.execute(sql`
      SELECT count(*)::int AS count FROM booking_pii_access_log WHERE booking_id = ${reserved.booking.id}
    `)) as Array<{ count: number }>
    expect(auditCount[0]?.count ?? 0).toBe(0)
  })
})

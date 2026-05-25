import {
  bookingGroups,
  bookingItems,
  bookingItemTravelers,
  bookings,
  bookingTravelers,
} from "@voyantjs/bookings/schema"
import { createEventBus } from "@voyantjs/core"
import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  bookingPaymentSchedules,
  invoiceRenditions,
  invoices,
  paymentInstruments,
  payments,
  voucherRedemptions,
  vouchers,
} from "../../src/schema.js"
import { createBooking } from "../../src/service-booking-create.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

async function resetTables(
  // biome-ignore lint/suspicious/noExplicitAny: test db
  db: any,
) {
  const tableNames = [
    "payments",
    "invoice_renditions",
    "invoice_line_items",
    "invoices",
    "voucher_redemptions",
    "vouchers",
    "payment_instruments",
    "booking_payment_schedules",
    "booking_allocations",
    "booking_item_travelers",
    "booking_travelers",
    "booking_group_members",
    "booking_groups",
    "booking_supplier_statuses",
    "booking_items",
    "bookings",
    "option_units",
    "product_day_services",
    "product_days",
    "product_ticket_settings",
    "product_options",
    "products",
  ]
  const existing = (await db.execute<{ tablename: string }>(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (${sql.join(
        tableNames.map((name) => sql`${name}`),
        sql`, `,
      )})
  `)) as Array<{ tablename: string }>

  if (existing.length === 0) return
  const names = existing.map((r) => `"${r.tablename}"`).join(", ")
  await db.execute(sql.raw(`TRUNCATE ${names} CASCADE`))
}

let productSeq = 0
let bookingSeq = 0
function nextBookingNumber() {
  bookingSeq += 1
  return `BK-BC-${String(bookingSeq).padStart(5, "0")}`
}

describe.skipIf(!DB_AVAILABLE)("createBooking", () => {
  let db: ReturnType<typeof import("@voyantjs/db/test-utils").createTestDb>

  beforeAll(async () => {
    const { createTestDb } = await import("@voyantjs/db/test-utils")
    db = createTestDb()
    await resetTables(db)
  })

  beforeEach(async () => {
    await resetTables(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyantjs/db/test-utils")
    await closeTestDb()
  })

  async function seedProduct({ pax = 2 }: { pax?: number | null } = {}) {
    productSeq += 1
    // Raw SQL keeps this free of a cross-package schema import. The booking-
    // create path only needs products + a default option + one option_unit;
    // we skip itinerary/day seeding because the orchestrator tolerates zero
    // day services (supplier statuses just stay empty).
    const productId = `prod_bc_${productSeq}`
    const optionId = `popt_bc_${productSeq}`
    const unitId = `opun_bc_${productSeq}`
    const itineraryId = `piti_bc_${productSeq}`
    await db.execute(sql`
      INSERT INTO products (id, name, sell_currency, sell_amount_cents, cost_amount_cents, margin_percent, start_date, end_date, pax)
      VALUES (
        ${productId},
        ${`Booking Create Product ${productSeq}`},
        'EUR',
        50000,
        30000,
        40,
        '2026-07-01',
        '2026-07-03',
        ${pax}
      )
    `)
    await db.execute(sql`
      INSERT INTO product_options (id, product_id, name, status, is_default, sort_order)
      VALUES (${optionId}, ${productId}, 'Standard', 'active', true, 0)
    `)
    await db.execute(sql`
      INSERT INTO option_units (id, option_id, name, unit_type, is_required, min_quantity, sort_order)
      VALUES (${unitId}, ${optionId}, 'Adult', 'person', true, 1, 0)
    `)
    await db.execute(sql`
      INSERT INTO product_itineraries (id, product_id, name, is_default, sort_order)
      VALUES (${itineraryId}, ${productId}, 'Default', true, 0)
    `)
    await db.execute(sql`
      INSERT INTO product_ticket_settings (id, product_id, fulfillment_mode, default_delivery_format, ticket_per_unit)
      VALUES (${`ptix_bc_${productSeq}`}, ${productId}, 'per_item', 'qr_code', false)
    `)

    return { productId, optionId, unitId }
  }

  async function seedVoucher(
    overrides: {
      code?: string
      remainingAmountCents?: number
      status?: "active" | "redeemed" | "void"
      expiresAt?: Date | null
    } = {},
  ) {
    const [row] = await db
      .insert(vouchers)
      .values({
        code: overrides.code ?? `BC-${productSeq}-${Date.now()}`,
        currency: "EUR",
        initialAmountCents: overrides.remainingAmountCents ?? 20000,
        remainingAmountCents: overrides.remainingAmountCents ?? 20000,
        status: overrides.status ?? "active",
        sourceType: "manual",
        expiresAt: overrides.expiresAt ?? null,
      })
      .returning()
    return row!
  }

  async function seedBookingGroup() {
    const [group] = await db
      .insert(bookingGroups)
      .values({
        kind: "shared_room",
        label: "Existing group",
      })
      .returning()
    return group!
  }

  function bookingParty() {
    return {
      personId: "pers_booking_create",
      contactFirstName: "Alice",
      contactLastName: "Lead",
      contactEmail: "alice@example.com",
      travelers: [
        {
          firstName: "Alice",
          lastName: "Lead",
          email: "alice@example.com",
          participantType: "traveler" as const,
          isPrimary: true,
        },
      ],
    }
  }

  it("derives booking pax from travelers when pax is omitted", async () => {
    const { productId } = await seedProduct({ pax: null })

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      catalogSellAmountCents: 50000,
      confirmedSellAmountCents: 50000,
      travelers: [
        {
          firstName: "Alice",
          lastName: "Lead",
          email: "alice@example.com",
          participantType: "traveler",
          isPrimary: true,
        },
        {
          firstName: "Bob",
          lastName: "Companion",
          participantType: "traveler",
        },
      ],
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return
    expect(outcome.result.booking.pax).toBe(2)

    const [bookingRow] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, outcome.result.booking.id))
    expect(bookingRow?.pax).toBe(2)
  })

  it("keeps explicit booking pax when travelers are also supplied", async () => {
    const { productId } = await seedProduct({ pax: null })

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      pax: 4,
      travelers: [
        {
          firstName: "Alice",
          lastName: "Lead",
          email: "alice@example.com",
          participantType: "traveler",
          isPrimary: true,
        },
        {
          firstName: "Bob",
          lastName: "Companion",
          participantType: "traveler",
        },
      ],
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return
    expect(outcome.result.booking.pax).toBe(4)

    const [bookingRow] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, outcome.result.booking.id))
    expect(bookingRow?.pax).toBe(4)
  })

  it("creates booking + travelers + payment schedules atomically", async () => {
    const { productId } = await seedProduct()

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      travelers: [
        {
          firstName: "Alice",
          lastName: "Lead",
          email: "alice@example.com",
          participantType: "traveler",
          isPrimary: true,
        },
        {
          firstName: "Bob",
          lastName: "Companion",
          participantType: "traveler",
          travelerCategory: "adult",
        },
      ],
      paymentSchedules: [
        {
          scheduleType: "deposit",
          status: "due",
          dueDate: "2026-06-15",
          currency: "EUR",
          amountCents: 20000,
        },
        {
          scheduleType: "balance",
          status: "pending",
          dueDate: "2026-06-30",
          currency: "EUR",
          amountCents: 30000,
        },
      ],
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return
    expect(outcome.result.booking.status).toBe("draft")
    expect(outcome.result.travelers).toHaveLength(2)
    expect(outcome.result.travelers[0]?.firstName).toBe("Alice")
    expect(outcome.result.paymentSchedules).toHaveLength(2)
    expect(outcome.result.voucherRedemption).toBeNull()
    expect(outcome.result.groupMembership).toBeNull()

    const bookingsRows = await db.select().from(bookings)
    expect(bookingsRows).toHaveLength(1)
    const travelerRows = await db
      .select()
      .from(bookingTravelers)
      .where(eq(bookingTravelers.bookingId, outcome.result.booking.id))
    expect(travelerRows).toHaveLength(2)
    const scheduleRows = await db
      .select()
      .from(bookingPaymentSchedules)
      .where(eq(bookingPaymentSchedules.bookingId, outcome.result.booking.id))
    expect(scheduleRows).toHaveLength(2)
  })

  it("rejects payment schedules in a currency different from booking sell currency", async () => {
    const { productId } = await seedProduct()

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      catalogSellAmountCents: 33000,
      confirmedSellAmountCents: 33000,
      paymentSchedules: [
        {
          scheduleType: "deposit",
          status: "pending",
          dueDate: "2026-02-21",
          currency: "RON",
          amountCents: 16500,
        },
        {
          scheduleType: "balance",
          status: "pending",
          dueDate: "2026-05-20",
          currency: "EUR",
          amountCents: 16500,
        },
      ],
    })

    expect(outcome.status).toBe("invalid_payment_schedules")
    if (outcome.status !== "invalid_payment_schedules") return
    expect(outcome.issues).toContainEqual({
      path: ["paymentSchedules", 0, "currency"],
      message: "paymentSchedules[0].currency must equal the booking's sellCurrency (EUR); got RON",
    })

    const bookingsRows = await db.select().from(bookings)
    expect(bookingsRows).toHaveLength(0)
  })

  it("rejects payment schedule totals that do not match confirmed booking total", async () => {
    const { productId } = await seedProduct()

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      catalogSellAmountCents: 33000,
      confirmedSellAmountCents: 33000,
      paymentSchedules: [
        {
          scheduleType: "deposit",
          status: "pending",
          dueDate: "2026-02-21",
          currency: "EUR",
          amountCents: 16500,
        },
      ],
    })

    expect(outcome.status).toBe("invalid_payment_schedules")
    if (outcome.status !== "invalid_payment_schedules") return
    expect(outcome.issues).toContainEqual({
      path: ["paymentSchedules"],
      message:
        "paymentSchedules amountCents sum (16500) must equal confirmedSellAmountCents (33000)",
    })

    const bookingsRows = await db.select().from(bookings)
    expect(bookingsRows).toHaveLength(0)
  })

  it("creates an invoice and completed payment records for already-paid schedules", async () => {
    const { productId } = await seedProduct()

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      paymentSchedules: [
        {
          scheduleType: "balance",
          status: "paid",
          dueDate: "2026-06-15",
          currency: "EUR",
          amountCents: 50000,
          notes: JSON.stringify({
            alreadyPaid: true,
            paymentDate: "2026-06-10",
            paymentMethod: "bank_transfer",
            paymentReference: "BT-PAID-1",
          }),
        },
      ],
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return
    expect(outcome.result.invoice?.bookingId).toBe(outcome.result.booking.id)
    expect(outcome.result.invoiceDocument.status).toBe("not_requested")
    expect(outcome.result.payments).toHaveLength(1)
    expect(outcome.result.payments[0]?.status).toBe("completed")
    expect(outcome.result.payments[0]?.referenceNumber).toBe("BT-PAID-1")

    const invoiceRows = await db
      .select()
      .from(invoices)
      .where(eq(invoices.bookingId, outcome.result.booking.id))
    expect(invoiceRows).toHaveLength(1)
    expect(invoiceRows[0]?.status).toBe("paid")

    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceRows[0]!.id))
    expect(paymentRows).toHaveLength(1)
  })

  it("requests an invoice rendition only when invoice document generation is enabled", async () => {
    const { productId } = await seedProduct()

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      documentGeneration: {
        contractDocument: false,
        invoiceDocument: true,
      },
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return
    expect(outcome.result.invoice?.bookingId).toBe(outcome.result.booking.id)
    expect(outcome.result.invoiceDocument.status).toBe("requested")

    const renditionRows = await db
      .select()
      .from(invoiceRenditions)
      .where(eq(invoiceRenditions.invoiceId, outcome.result.invoice!.id))
    expect(renditionRows).toHaveLength(1)
    expect(renditionRows[0]?.status).toBe("pending")
  })

  it("creates explicit booking item lines for multiple selected units", async () => {
    const { productId, optionId, unitId } = await seedProduct()
    const secondUnitId = `opun_bc_single_${productSeq}`
    await db.execute(sql`
      INSERT INTO option_units (id, option_id, name, unit_type, is_required, min_quantity, sort_order)
      VALUES (${secondUnitId}, ${optionId}, 'Single room', 'room', false, 1, 1)
    `)

    const outcome = await createBooking(db, {
      productId,
      optionId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      catalogSellAmountCents: 30000,
      confirmedSellAmountCents: 30000,
      itemLines: [
        {
          optionUnitId: unitId,
          quantity: 2,
          title: "Double room",
          unitSellAmountCents: 10000,
          totalSellAmountCents: 20000,
        },
        {
          optionUnitId: secondUnitId,
          quantity: 1,
          title: "Single room",
          unitSellAmountCents: 10000,
          totalSellAmountCents: 10000,
        },
      ],
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return

    const itemRows = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, outcome.result.booking.id))
    expect(itemRows).toHaveLength(2)
    expect(itemRows.map((item) => [item.optionUnitId, item.quantity])).toEqual([
      [unitId, 2],
      [secondUnitId, 1],
    ])
  })

  it("links explicit item and per-person extra lines to travelers", async () => {
    const { productId, unitId } = await seedProduct()

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      travelers: [
        {
          firstName: "Alice",
          lastName: "Lead",
          email: "alice@example.com",
          participantType: "traveler",
          isPrimary: true,
        },
        {
          firstName: "Child",
          lastName: "Traveler",
          participantType: "traveler",
          travelerCategory: "child",
        },
      ],
      itemLines: [
        {
          clientLineKey: `unit:${unitId}`,
          optionUnitId: unitId,
          quantity: 2,
          title: "Adult",
          travelerIndexes: [0, 1],
        },
      ],
      extraLines: [
        {
          clientLineKey: "extra:lunch",
          productExtraId: "lunch",
          name: "Lunch",
          pricingMode: "per_person",
          pricedPerPerson: true,
          quantity: 2,
          sellCurrency: "EUR",
          unitSellAmountCents: 1000,
          totalSellAmountCents: 2000,
          travelerIndexes: [0, 1],
        },
      ],
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return

    const links = await db
      .select()
      .from(bookingItemTravelers)
      .where(sql`${bookingItemTravelers.bookingItemId} IN (
        SELECT ${bookingItems.id}
        FROM ${bookingItems}
        WHERE ${bookingItems.bookingId} = ${outcome.result.booking.id}
      )`)
    expect(links).toHaveLength(4)
  })

  it("redeems voucher and decrements remaining balance", async () => {
    const { productId } = await seedProduct()
    const voucher = await seedVoucher({ remainingAmountCents: 25000 })

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      voucherRedemption: {
        voucherId: voucher.id,
        amountCents: 10000,
      },
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return
    expect(outcome.result.voucherRedemption?.voucher.remainingAmountCents).toBe(15000)
    expect(outcome.result.voucherRedemption?.redemption.amountCents).toBe(10000)

    const [updatedVoucher] = await db.select().from(vouchers).where(eq(vouchers.id, voucher.id))
    expect(updatedVoucher?.remainingAmountCents).toBe(15000)

    const redemptionRows = await db
      .select()
      .from(voucherRedemptions)
      .where(eq(voucherRedemptions.voucherId, voucher.id))
    expect(redemptionRows).toHaveLength(1)
    expect(redemptionRows[0]?.bookingId).toBe(outcome.result.booking.id)
  })

  it("rolls back booking + travelers when voucher has insufficient balance", async () => {
    const { productId } = await seedProduct()
    const voucher = await seedVoucher({ remainingAmountCents: 500 })

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      travelers: [{ firstName: "Will", lastName: "Rollback", participantType: "traveler" }],
      paymentSchedules: [
        {
          scheduleType: "balance",
          dueDate: "2026-06-30",
          currency: "EUR",
          amountCents: 10000,
        },
      ],
      voucherRedemption: { voucherId: voucher.id, amountCents: 2000 },
    })

    expect(outcome.status).toBe("voucher_insufficient_balance")
    expect(await db.select().from(bookings)).toHaveLength(0)
    expect(await db.select().from(bookingTravelers)).toHaveLength(0)
    expect(await db.select().from(bookingPaymentSchedules)).toHaveLength(0)

    // Voucher balance untouched.
    const [same] = await db.select().from(vouchers).where(eq(vouchers.id, voucher.id))
    expect(same?.remainingAmountCents).toBe(500)
  })

  it("returns voucher_not_found for unknown voucher id (no booking created)", async () => {
    const { productId } = await seedProduct()

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      voucherRedemption: { voucherId: "vchr_missing", amountCents: 1000 },
    })

    expect(outcome.status).toBe("voucher_not_found")
    expect(await db.select().from(bookings)).toHaveLength(0)
  })

  it("returns voucher_inactive for non-active voucher", async () => {
    const { productId } = await seedProduct()
    const voucher = await seedVoucher({ status: "void" })

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      voucherRedemption: { voucherId: voucher.id, amountCents: 1000 },
    })
    expect(outcome.status).toBe("voucher_inactive")
  })

  it("returns voucher_expired for past expiresAt", async () => {
    const { productId } = await seedProduct()
    const voucher = await seedVoucher({ expiresAt: new Date("2020-01-01") })

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      voucherRedemption: { voucherId: voucher.id, amountCents: 1000 },
    })
    expect(outcome.status).toBe("voucher_expired")
  })

  it("creates a new booking group and attaches the booking as primary", async () => {
    const { productId } = await seedProduct()

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      groupMembership: {
        action: "create",
        kind: "shared_room",
        label: "My shared group",
      },
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return
    expect(outcome.result.groupMembership?.member.role).toBe("primary")

    const groupRows = await db.select().from(bookingGroups)
    expect(groupRows).toHaveLength(1)
    expect(groupRows[0]?.label).toBe("My shared group")
    expect(groupRows[0]?.primaryBookingId).toBe(outcome.result.booking.id)
  })

  it("joins an existing booking group", async () => {
    const { productId } = await seedProduct()
    const group = await seedBookingGroup()

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      groupMembership: {
        action: "join",
        groupId: group.id,
        role: "shared",
      },
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return
    expect(outcome.result.groupMembership?.groupId).toBe(group.id)
    expect(outcome.result.groupMembership?.member.role).toBe("shared")
  })

  it("returns group_not_found for missing group (nothing written)", async () => {
    const { productId } = await seedProduct()

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      travelers: [{ firstName: "Orphan", lastName: "Ghost", participantType: "traveler" }],
      groupMembership: { action: "join", groupId: "bgrp_missing", role: "shared" },
    })

    expect(outcome.status).toBe("group_not_found")
    expect(await db.select().from(bookings)).toHaveLength(0)
    expect(await db.select().from(bookingTravelers)).toHaveLength(0)
  })

  it("returns product_not_found for unknown productId", async () => {
    const outcome = await createBooking(db, {
      productId: "prod_nope",
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
    })

    expect(outcome.status).toBe("product_not_found")
    expect(await db.select().from(bookings)).toHaveLength(0)
  })

  it("emits booking.created event after commit when runtime provided", async () => {
    const { productId } = await seedProduct()
    const eventBus = createEventBus()
    const received: unknown[] = []
    eventBus.subscribe("booking.created", (event) => {
      received.push(event)
    })

    const outcome = await createBooking(
      db,
      {
        productId,
        bookingNumber: nextBookingNumber(),
        ...bookingParty(),
        travelers: [{ firstName: "Evt", lastName: "Listener", participantType: "traveler" }],
      },
      { runtime: { eventBus }, userId: "usrp_tester" },
    )

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return

    // Give the event bus a tick since subscribers run async.
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(received).toHaveLength(1)
    const envelope = received[0] as {
      name: string
      data: {
        bookingId: string
        travelerCount: number
        createdByUserId: string | null
      }
    }
    expect(envelope.name).toBe("booking.created")
    expect(envelope.data.bookingId).toBe(outcome.result.booking.id)
    expect(envelope.data.travelerCount).toBe(1)
    expect(envelope.data.createdByUserId).toBe("usrp_tester")
  })

  it("leaves payment_instruments untouched even when voucher orchestration runs", async () => {
    // Regression guard: the fallback voucher path reads payment_instruments;
    // the new orchestrator should never write to it.
    const { productId } = await seedProduct()
    const voucher = await seedVoucher({ remainingAmountCents: 20000 })

    await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      voucherRedemption: { voucherId: voucher.id, amountCents: 5000 },
    })

    expect(await db.select().from(paymentInstruments)).toHaveLength(0)
  })
})

// agent-quality: file-size exception -- owner: finance; existing coverage file stays co-located until a dedicated split preserves behavior and tests.
import { actionLedgerEntries } from "@voyant-travel/action-ledger/schema"
import {
  bookingGroups,
  bookingItems,
  bookingItemTravelers,
  bookings,
  bookingTravelers,
} from "@voyant-travel/bookings/schema"
import { createEventBus } from "@voyant-travel/core"
import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  bookingPaymentSchedules,
  invoiceRenditions,
  invoices,
  paymentInstruments,
  payments,
  travelCreditRedemptions,
  travelCredits,
} from "../../src/schema.js"
import { bookingCreateSchema, createBooking } from "../../src/service-booking-create.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

async function resetTables(
  // biome-ignore lint/suspicious/noExplicitAny: test db -- owner: finance; existing suppression is intentional pending typed cleanup.
  db: any,
) {
  const tableNames = [
    "action_ledger_entries",
    "payments",
    "invoice_renditions",
    "invoice_line_items",
    "invoices",
    "travel_credit_redemptions",
    "travel_credits",
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
    "availability_slots",
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
        // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
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
  let db: ReturnType<typeof import("@voyant-travel/db/test-utils").createTestDb>

  beforeAll(async () => {
    const { createTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await resetTables(db)
  })

  beforeEach(async () => {
    await resetTables(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  async function seedProduct({
    pax = 2,
    ageBandedUnits = false,
  }: {
    pax?: number | null
    ageBandedUnits?: boolean
  } = {}) {
    productSeq += 1
    // Raw SQL keeps this free of a cross-package schema import. The booking-
    // create path only needs products + a default option + one option_unit;
    // we skip itinerary/day seeding because the orchestrator tolerates zero
    // day services (supplier statuses just stay empty).
    const productId = `prod_bc_${productSeq}`
    const optionId = `popt_bc_${productSeq}`
    const unitId = `opun_bc_${productSeq}`
    const childUnitId = `opun_bc_${productSeq}_child`
    const infantUnitId = `opun_bc_${productSeq}_infant`
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
      INSERT INTO option_units (id, option_id, name, code, unit_type, min_age, max_age, is_required, min_quantity, sort_order)
      VALUES (
        ${unitId},
        ${optionId},
        'Adult',
        ${ageBandedUnits ? "ADULT" : null},
        'person',
        ${ageBandedUnits ? 13 : null},
        null,
        true,
        1,
        0
      )
    `)
    if (ageBandedUnits) {
      await db.execute(sql`
        INSERT INTO option_units (id, option_id, name, code, unit_type, min_age, max_age, is_required, min_quantity, sort_order)
        VALUES
          (${childUnitId}, ${optionId}, 'Child 6-12', 'CHILD', 'person', 6, 12, false, 0, 1),
          (${infantUnitId}, ${optionId}, 'Infant 0-5', 'INFANT', 'person', 0, 5, false, 0, 2)
      `)
    }
    await db.execute(sql`
      INSERT INTO product_itineraries (id, product_id, name, is_default, sort_order)
      VALUES (${itineraryId}, ${productId}, 'Default', true, 0)
    `)
    await db.execute(sql`
      INSERT INTO product_ticket_settings (id, product_id, fulfillment_mode, default_delivery_format, ticket_per_unit)
      VALUES (${`ptix_bc_${productSeq}`}, ${productId}, 'per_item', 'qr_code', false)
    `)

    return { productId, optionId, unitId, childUnitId, infantUnitId }
  }

  async function seedAccommodationProduct() {
    productSeq += 1
    const productId = `prod_bc_accom_${productSeq}`
    const optionId = `popt_bc_accom_${productSeq}`
    const roomUnitId = `opun_bc_accom_${productSeq}_dbl`
    const adultUnitId = `opun_bc_accom_${productSeq}_adult`
    const itineraryId = `piti_bc_accom_${productSeq}`
    await db.execute(sql`
      INSERT INTO products (id, name, sell_currency, sell_amount_cents, cost_amount_cents, margin_percent, start_date, end_date, pax)
      VALUES (
        ${productId},
        ${`Accommodation Product ${productSeq}`},
        'EUR',
        50000,
        30000,
        40,
        '2026-07-01',
        '2026-07-03',
        2
      )
    `)
    await db.execute(sql`
      INSERT INTO product_options (id, product_id, name, status, is_default, sort_order)
      VALUES (${optionId}, ${productId}, 'DBL', 'active', true, 0)
    `)
    await db.execute(sql`
      INSERT INTO option_units (
        id,
        option_id,
        name,
        code,
        unit_type,
        min_age,
        occupancy_min,
        occupancy_max,
        is_required,
        min_quantity,
        sort_order
      )
      VALUES
        (${roomUnitId}, ${optionId}, 'DBL room', 'dbl_room', 'room', null, 1, 2, true, 1, 0),
        (${adultUnitId}, ${optionId}, 'Adult', 'adult', 'person', 18, null, null, true, 1, 1)
    `)
    await db.execute(sql`
      INSERT INTO product_itineraries (id, product_id, name, is_default, sort_order)
      VALUES (${itineraryId}, ${productId}, 'Default', true, 0)
    `)
    await db.execute(sql`
      INSERT INTO product_ticket_settings (id, product_id, fulfillment_mode, default_delivery_format, ticket_per_unit)
      VALUES (${`ptix_bc_accom_${productSeq}`}, ${productId}, 'per_item', 'qr_code', false)
    `)

    return { productId, optionId, roomUnitId, adultUnitId }
  }

  async function seedSingleFirstAccommodationProduct({
    singleRoomOccupancyMax = 1,
  }: {
    singleRoomOccupancyMax?: number | null
  } = {}) {
    productSeq += 1
    const productId = `prod_bc_accom_sgl_${productSeq}`
    const optionId = `popt_bc_accom_sgl_${productSeq}`
    const singleRoomUnitId = `opun_bc_accom_sgl_${productSeq}`
    const doubleRoomUnitId = `opun_bc_accom_dbl_${productSeq}`
    const adultUnitId = `opun_bc_accom_adult_${productSeq}`
    const itineraryId = `piti_bc_accom_sgl_${productSeq}`
    await db.execute(sql`
      INSERT INTO products (id, name, sell_currency, sell_amount_cents, cost_amount_cents, margin_percent, start_date, end_date, pax)
      VALUES (
        ${productId},
        ${`SGL-first Accommodation Product ${productSeq}`},
        'EUR',
        50000,
        30000,
        40,
        '2026-07-01',
        '2026-07-03',
        2
      )
    `)
    await db.execute(sql`
      INSERT INTO product_options (id, product_id, name, status, is_default, sort_order)
      VALUES (${optionId}, ${productId}, 'Standard', 'active', true, 0)
    `)
    await db.execute(sql`
      INSERT INTO option_units (
        id,
        option_id,
        name,
        code,
        unit_type,
        min_age,
        occupancy_min,
        occupancy_max,
        is_required,
        min_quantity,
        sort_order
      )
      VALUES
        (${singleRoomUnitId}, ${optionId}, 'SGL room', 'sgl_room', 'room', null, 1, ${singleRoomOccupancyMax}, true, 1, 0),
        (${doubleRoomUnitId}, ${optionId}, 'DBL room', 'dbl_room', 'room', null, 1, 2, false, 0, 1),
        (${adultUnitId}, ${optionId}, 'Adult', 'adult', 'person', 18, null, null, true, 1, 2)
    `)
    await db.execute(sql`
      INSERT INTO product_itineraries (id, product_id, name, is_default, sort_order)
      VALUES (${itineraryId}, ${productId}, 'Default', true, 0)
    `)
    await db.execute(sql`
      INSERT INTO product_ticket_settings (id, product_id, fulfillment_mode, default_delivery_format, ticket_per_unit)
      VALUES (${`ptix_bc_accom_sgl_${productSeq}`}, ${productId}, 'per_item', 'qr_code', false)
    `)

    return { productId, optionId, singleRoomUnitId, doubleRoomUnitId, adultUnitId }
  }

  async function seedTravelCredit(
    overrides: {
      code?: string
      remainingAmountCents?: number
      status?: "active" | "redeemed" | "void"
      expiresAt?: Date | null
    } = {},
  ) {
    const [row] = await db
      .insert(travelCredits)
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

  async function seedSlot(input: { productId: string; optionId?: string | null }) {
    const slotId = `avsl_bc_${productSeq}_${Date.now()}`
    const rows = await db.execute<{ id: string }>(sql`
      INSERT INTO availability_slots (
        id,
        product_id,
        option_id,
        date_local,
        starts_at,
        ends_at,
        timezone,
        status,
        unlimited,
        initial_pax,
        remaining_pax,
        created_at,
        updated_at
      )
      VALUES (
        ${slotId},
        ${input.productId},
        ${input.optionId ?? null},
        '2026-07-01',
        '2026-07-01T09:00:00.000Z',
        '2026-07-01T11:00:00.000Z',
        'Europe/Bucharest',
        'open',
        false,
        10,
        10,
        now(),
        now()
      )
      RETURNING id
    `)

    const slot = rows[0]
    if (!slot) throw new Error("seedSlot: insert returned no rows")
    return slot
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
    expect(outcome.result.travelCreditRedemption).toBeNull()
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

  it("rejects duplicate active bookings for the same billing party and slot", async () => {
    const { productId, optionId } = await seedProduct()
    const slot = await seedSlot({ productId, optionId })

    const first = await createBooking(db, {
      productId,
      optionId,
      slotId: slot.id,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
    })

    expect(first.status).toBe("ok")
    if (first.status !== "ok") return

    const duplicate = await createBooking(db, {
      productId,
      optionId,
      slotId: slot.id,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
    })

    expect(duplicate.status).toBe("duplicate_booking")
    if (duplicate.status !== "duplicate_booking") return
    expect(duplicate.existingBooking).toMatchObject({
      id: first.result.booking.id,
      bookingNumber: first.result.booking.bookingNumber,
      status: first.result.booking.status,
    })

    const bookingRows = await db.select().from(bookings)
    expect(bookingRows).toHaveLength(1)
  })

  it("writes action ledger entries for successful creates and duplicate rejections", async () => {
    const { productId, optionId } = await seedProduct()
    const slot = await seedSlot({ productId, optionId })
    const runtime = {
      actionLedgerContext: {
        userId: "user_booking_create_ledger",
        callerType: "session" as const,
        actor: "staff",
      },
      actionLedgerAuthorizationSource: "booking.create.route",
    }

    const first = await createBooking(
      db,
      {
        productId,
        optionId,
        slotId: slot.id,
        bookingNumber: nextBookingNumber(),
        ...bookingParty(),
      },
      { userId: "user_booking_create_ledger", runtime },
    )

    expect(first.status).toBe("ok")
    if (first.status !== "ok") return

    const duplicate = await createBooking(
      db,
      {
        productId,
        optionId,
        slotId: slot.id,
        bookingNumber: nextBookingNumber(),
        ...bookingParty(),
      },
      { userId: "user_booking_create_ledger", runtime },
    )

    expect(duplicate.status).toBe("duplicate_booking")

    const ledgerRows = await db
      .select()
      .from(actionLedgerEntries)
      .where(eq(actionLedgerEntries.actionName, "booking.create"))

    expect(ledgerRows).toHaveLength(2)
    expect(ledgerRows.find((row) => row.status === "succeeded")).toMatchObject({
      actionKind: "create",
      targetType: "booking",
      targetId: first.result.booking.id,
      principalType: "user",
      principalId: "user_booking_create_ledger",
      actorType: "staff",
      routeOrToolName: "booking.create",
      authorizationSource: "booking.create.route",
    })
    expect(ledgerRows.find((row) => row.status === "failed")).toMatchObject({
      actionKind: "create",
      targetType: "booking",
      targetId: first.result.booking.id,
      principalType: "user",
      principalId: "user_booking_create_ledger",
      actorType: "staff",
      routeOrToolName: "booking.create",
      authorizationSource: "booking.create.route",
    })
  })

  it("allows duplicate active bookings when explicitly overridden", async () => {
    const { productId, optionId } = await seedProduct()
    const slot = await seedSlot({ productId, optionId })

    const first = await createBooking(db, {
      productId,
      optionId,
      slotId: slot.id,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
    })
    expect(first.status).toBe("ok")

    const second = await createBooking(db, {
      productId,
      optionId,
      slotId: slot.id,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      allowDuplicate: true,
    })

    expect(second.status).toBe("ok")
    const bookingRows = await db.select().from(bookings)
    expect(bookingRows).toHaveLength(2)
  })

  it("ignores cancelled bookings when checking duplicates", async () => {
    const { productId, optionId } = await seedProduct()
    const slot = await seedSlot({ productId, optionId })

    const first = await createBooking(db, {
      productId,
      optionId,
      slotId: slot.id,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
    })
    expect(first.status).toBe("ok")
    if (first.status !== "ok") return

    await db
      .update(bookings)
      .set({ status: "cancelled" })
      .where(eq(bookings.id, first.result.booking.id))

    const second = await createBooking(db, {
      productId,
      optionId,
      slotId: slot.id,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
    })

    expect(second.status).toBe("ok")
    const bookingRows = await db.select().from(bookings)
    expect(bookingRows).toHaveLength(2)
  })

  it("ignores expired bookings when checking duplicates", async () => {
    const { productId, optionId } = await seedProduct()
    const slot = await seedSlot({ productId, optionId })

    const first = await createBooking(db, {
      productId,
      optionId,
      slotId: slot.id,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
    })
    expect(first.status).toBe("ok")
    if (first.status !== "ok") return

    await db
      .update(bookings)
      .set({ status: "expired" })
      .where(eq(bookings.id, first.result.booking.id))

    const second = await createBooking(db, {
      productId,
      optionId,
      slotId: slot.id,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
    })

    expect(second.status).toBe("ok")
    const bookingRows = await db.select().from(bookings)
    expect(bookingRows).toHaveLength(2)
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

  it("rejects already-paid schedules without an explicit payment date", async () => {
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
            paymentDate: null,
            paymentMethod: "bank_transfer",
            paymentReference: "BT-PAID-1",
          }),
        },
      ],
    })

    expect(outcome.status).toBe("invalid_payment_schedules")
    if (outcome.status !== "invalid_payment_schedules") return
    expect(outcome.issues).toContainEqual({
      path: ["paymentSchedules", 0, "notes", "paymentDate"],
      message: "paymentSchedules[0] marked paid requires notes.paymentDate",
    })

    const bookingsRows = await db.select().from(bookings)
    expect(bookingsRows).toHaveLength(0)
  })

  it("rejects already-paid schedules with non-string payment dates", async () => {
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
            paymentDate: 123,
            paymentMethod: "bank_transfer",
            paymentReference: "BT-PAID-1",
          }),
        },
      ],
    })

    expect(outcome.status).toBe("invalid_payment_schedules")
    if (outcome.status !== "invalid_payment_schedules") return
    expect(outcome.issues).toContainEqual({
      path: ["paymentSchedules", 0, "notes", "paymentDate"],
      message: "paymentSchedules[0] marked paid requires notes.paymentDate",
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

  it("applies the invoice due-date resolver to schedule-derived booking-create invoices", async () => {
    const { productId } = await seedProduct()
    let resolverScheduleDueDate: string | null = null

    const outcome = await createBooking(
      db,
      {
        productId,
        bookingNumber: nextBookingNumber(),
        ...bookingParty(),
        paymentSchedules: [
          {
            scheduleType: "balance",
            dueDate: "2020-01-01",
            currency: "EUR",
            amountCents: 50000,
          },
        ],
        documentGeneration: {
          contractDocument: false,
          invoiceDocument: true,
        },
      },
      {
        runtime: {
          invoiceDueDateResolver: ({ issueDate, dueDate, bookingPaymentSchedule }) => {
            resolverScheduleDueDate = bookingPaymentSchedule?.dueDate ?? null
            return bookingPaymentSchedule && dueDate < issueDate ? issueDate : dueDate
          },
        },
      },
    )

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return
    expect(resolverScheduleDueDate).toBe("2020-01-01")
    expect(outcome.result.invoice?.issueDate).toBeTruthy()
    expect(outcome.result.invoice?.dueDate).toBe(outcome.result.invoice?.issueDate)
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

    // Two travelers × (1 item + 1 extra) = 4 link rows when the
    // server stamps `metadata.bookingCreateLineKey` on each item and
    // resolves it through `linkBookingCreateItemsToTravelers`.
    const links = await db
      .select()
      .from(bookingItemTravelers)
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .where(sql`${bookingItemTravelers.bookingItemId} IN (
        SELECT ${bookingItems.id}
        FROM ${bookingItems}
        WHERE ${bookingItems.bookingId} = ${outcome.result.booking.id}
      )`)
    expect(links).toHaveLength(4)
  })

  it("links item and extra lines to reordered travelers through stable keys", async () => {
    const { productId, unitId } = await seedProduct()

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      travelers: [
        {
          clientTravelerKey: "trav:child",
          firstName: "Child",
          lastName: "Traveler",
          participantType: "traveler",
          travelerCategory: "child",
        },
        {
          clientTravelerKey: "trav:lead",
          firstName: "Alice",
          lastName: "Lead",
          email: "alice@example.com",
          participantType: "traveler",
          travelerCategory: "adult",
          isPrimary: true,
        },
      ],
      itemLines: [
        {
          clientLineKey: `unit:${unitId}`,
          optionUnitId: unitId,
          quantity: 1,
          title: "Adult",
          travelerKeys: ["trav:lead"],
        },
      ],
      extraLines: [
        {
          clientLineKey: "extra:lunch",
          productExtraId: "lunch",
          name: "Lunch",
          pricingMode: "per_person",
          pricedPerPerson: true,
          quantity: 1,
          sellCurrency: "EUR",
          unitSellAmountCents: 1000,
          totalSellAmountCents: 1000,
          travelerKeys: ["trav:child"],
        },
      ],
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return

    const linkedRows = await db.execute<{ item_title: string; traveler_last_name: string }>(sql`
      SELECT bi.title AS item_title, bt.last_name AS traveler_last_name
      FROM booking_item_travelers bit
      JOIN booking_items bi ON bi.id = bit.booking_item_id
      JOIN booking_travelers bt ON bt.id = bit.traveler_id
      WHERE bi.booking_id = ${outcome.result.booking.id}
      ORDER BY bi.title, bt.last_name
    `)
    expect(linkedRows).toEqual([
      { item_title: "Adult", traveler_last_name: "Lead" },
      { item_title: "Lunch", traveler_last_name: "Traveler" },
    ])
  })

  it("creates a multi-day accommodation booking as one room item linked to both travelers", async () => {
    const { productId, roomUnitId } = await seedAccommodationProduct()
    const bundledTotalAmountCents = 60_000

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      catalogSellAmountCents: bundledTotalAmountCents,
      confirmedSellAmountCents: bundledTotalAmountCents,
      travelers: [
        {
          firstName: "Alice",
          lastName: "Lead",
          email: "alice@example.com",
          participantType: "traveler",
          travelerCategory: "adult",
          isPrimary: true,
        },
        {
          firstName: "Bob",
          lastName: "Companion",
          participantType: "traveler",
          travelerCategory: "adult",
        },
      ],
      itemLines: [
        {
          clientLineKey: `unit:${roomUnitId}`,
          optionUnitId: roomUnitId,
          quantity: 1,
          title: "DBL room",
          unitSellAmountCents: bundledTotalAmountCents,
          totalSellAmountCents: bundledTotalAmountCents,
          travelerIndexes: [0, 1],
        },
      ],
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return
    expect(outcome.result.booking.sellAmountCents).toBe(bundledTotalAmountCents)

    const itemRows = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, outcome.result.booking.id))
    expect(itemRows).toHaveLength(1)
    expect(itemRows[0]).toMatchObject({
      optionUnitId: roomUnitId,
      quantity: 1,
      totalSellAmountCents: bundledTotalAmountCents,
    })

    const links = await db
      .select()
      .from(bookingItemTravelers)
      .where(eq(bookingItemTravelers.bookingItemId, itemRows[0]!.id))
    expect(links).toHaveLength(2)
  })

  it("normalizes legacy adult-keyed accommodation item lines onto the room unit", async () => {
    const { productId, roomUnitId, adultUnitId } = await seedAccommodationProduct()
    const bundledTotalAmountCents = 60_000

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      catalogSellAmountCents: bundledTotalAmountCents,
      confirmedSellAmountCents: bundledTotalAmountCents,
      travelers: [
        {
          firstName: "Alice",
          lastName: "Lead",
          email: "alice@example.com",
          participantType: "traveler",
          travelerCategory: "adult",
          isPrimary: true,
        },
        {
          firstName: "Bob",
          lastName: "Companion",
          participantType: "traveler",
          travelerCategory: "adult",
        },
      ],
      itemLines: [
        {
          clientLineKey: `unit:${adultUnitId}`,
          optionUnitId: adultUnitId,
          quantity: 1,
          title: "Adult",
          unitSellAmountCents: bundledTotalAmountCents,
          totalSellAmountCents: bundledTotalAmountCents,
          travelerIndexes: [0, 1],
        },
      ],
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return

    const itemRows = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, outcome.result.booking.id))
    expect(itemRows).toHaveLength(1)
    expect(itemRows[0]).toMatchObject({
      optionUnitId: roomUnitId,
      quantity: 1,
      totalSellAmountCents: bundledTotalAmountCents,
    })

    const links = await db
      .select()
      .from(bookingItemTravelers)
      .where(eq(bookingItemTravelers.bookingItemId, itemRows[0]!.id))
    expect(links).toHaveLength(2)
  })

  it("rejects selected room units that cannot seat the booking pax", async () => {
    const { productId, singleRoomUnitId } = await seedSingleFirstAccommodationProduct()

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
          travelerCategory: "adult",
          isPrimary: true,
        },
        {
          firstName: "Bob",
          lastName: "Companion",
          participantType: "traveler",
          travelerCategory: "adult",
        },
      ],
      itemLines: [
        {
          optionUnitId: singleRoomUnitId,
          quantity: 1,
          title: "SGL room",
        },
      ],
    })

    expect(outcome).toEqual({
      status: "room_occupancy_insufficient",
      pax: 2,
      occupancyMax: 1,
      shortfall: 1,
    })
    expect(await db.select().from(bookings)).toHaveLength(0)
    expect(await db.select().from(bookingItems)).toHaveLength(0)
  })

  it("defaults missing room occupancy max to one seat per selected room", async () => {
    const { productId, singleRoomUnitId } = await seedSingleFirstAccommodationProduct({
      singleRoomOccupancyMax: null,
    })

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
          travelerCategory: "adult",
          isPrimary: true,
        },
        {
          firstName: "Bob",
          lastName: "Companion",
          participantType: "traveler",
          travelerCategory: "adult",
        },
      ],
      itemLines: [
        {
          optionUnitId: singleRoomUnitId,
          quantity: 2,
          title: "SGL room",
        },
      ],
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return

    const itemRows = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, outcome.result.booking.id))
    expect(itemRows).toHaveLength(1)
    expect(itemRows[0]).toMatchObject({
      optionUnitId: singleRoomUnitId,
      quantity: 2,
    })
  })

  it("rejects omitted accommodation item lines when the seeded room cannot seat pax", async () => {
    const { productId } = await seedSingleFirstAccommodationProduct()

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
          travelerCategory: "adult",
          isPrimary: true,
        },
        {
          firstName: "Bob",
          lastName: "Companion",
          participantType: "traveler",
          travelerCategory: "adult",
        },
      ],
    })

    expect(outcome).toEqual({
      status: "room_occupancy_insufficient",
      pax: 2,
      occupancyMax: 1,
      shortfall: 1,
    })
    expect(await db.select().from(bookings)).toHaveLength(0)
    expect(await db.select().from(bookingItems)).toHaveLength(0)
  })

  it("rejects duplicate stable traveler keys", async () => {
    const { productId, unitId } = await seedProduct()

    const result = bookingCreateSchema.safeParse({
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      travelers: [
        {
          clientTravelerKey: "trav:duplicate",
          firstName: "Alice",
          lastName: "Lead",
          participantType: "traveler",
          travelerCategory: "adult",
          isPrimary: true,
        },
        {
          clientTravelerKey: "trav:duplicate",
          firstName: "Bob",
          lastName: "Traveler",
          participantType: "traveler",
          travelerCategory: "adult",
        },
      ],
      itemLines: [
        {
          clientLineKey: `unit:${unitId}`,
          optionUnitId: unitId,
          quantity: 1,
          title: "Adult",
          travelerKeys: ["trav:duplicate"],
        },
      ],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "Duplicate clientTravelerKey: trav:duplicate",
        }),
      ]),
    )
  })

  it("rejects item and extra lines that reference unknown stable traveler keys", async () => {
    const { productId, unitId } = await seedProduct()

    const result = bookingCreateSchema.safeParse({
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      travelers: [
        {
          clientTravelerKey: "trav:lead",
          firstName: "Alice",
          lastName: "Lead",
          participantType: "traveler",
          travelerCategory: "adult",
          isPrimary: true,
        },
      ],
      itemLines: [
        {
          clientLineKey: `unit:${unitId}`,
          optionUnitId: unitId,
          quantity: 1,
          title: "Adult",
          travelerKeys: ["trav:missing-item"],
        },
      ],
      extraLines: [
        {
          clientLineKey: "extra:lunch",
          productExtraId: "lunch",
          name: "Lunch",
          pricingMode: "per_person",
          pricedPerPerson: true,
          quantity: 1,
          sellCurrency: "EUR",
          unitSellAmountCents: 1000,
          totalSellAmountCents: 1000,
          travelerKeys: ["trav:missing-extra"],
        },
      ],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["itemLines", 0, "travelerKeys", 0],
          message: "Unknown travelerKey: trav:missing-item",
        }),
        expect.objectContaining({
          path: ["extraLines", 0, "travelerKeys", 0],
          message: "Unknown travelerKey: trav:missing-extra",
        }),
      ]),
    )
  })

  it("rejects booking-create payloads that drift from the server draft resolver", async () => {
    const { productId, unitId, childUnitId, infantUnitId } = await seedProduct({
      ageBandedUnits: true,
    })
    const eventBus = createEventBus()
    const rejectedEvents: unknown[] = []
    eventBus.subscribe("booking_create.rejected", (event) => {
      rejectedEvents.push(event)
    })

    const outcome = await createBooking(
      db,
      {
        productId,
        bookingNumber: nextBookingNumber(),
        ...bookingParty(),
        travelers: [
          {
            firstName: "Alice",
            lastName: "Lead",
            email: "alice@example.com",
            participantType: "traveler",
            travelerCategory: "adult",
            isPrimary: true,
          },
          {
            firstName: "Child",
            lastName: "Traveler",
            participantType: "traveler",
            travelerCategory: "child",
          },
          {
            firstName: "Infant",
            lastName: "Traveler",
            participantType: "traveler",
            travelerCategory: "infant",
          },
        ],
        itemLines: [
          {
            clientLineKey: `unit:${unitId}`,
            optionUnitId: unitId,
            quantity: 3,
            title: "Adult",
            travelerIndexes: [0, 1, 2],
          },
        ],
      },
      { runtime: { eventBus }, userId: "usrp_tester" },
    )

    expect(outcome.status).toBe("payload_resolver_mismatch")
    if (outcome.status !== "payload_resolver_mismatch") return
    expect(outcome.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          optionUnitId: unitId,
          submittedQuantity: 3,
          resolvedQuantity: 1,
        }),
        expect.objectContaining({
          optionUnitId: childUnitId,
          submittedQuantity: 0,
          resolvedQuantity: 1,
        }),
        expect.objectContaining({
          optionUnitId: infantUnitId,
          submittedQuantity: 0,
          resolvedQuantity: 1,
        }),
      ]),
    )
    expect(await db.select().from(bookings)).toHaveLength(0)
    expect(await db.select().from(bookingTravelers)).toHaveLength(0)
    expect(await db.select().from(bookingItems)).toHaveLength(0)

    expect(rejectedEvents).toHaveLength(1)
    const event = rejectedEvents[0] as {
      name: string
      data: {
        reason: string
        productId: string
        mismatchCount: number
        createdByUserId: string | null
      }
      metadata?: { category?: string; source?: string }
    }
    expect(event.name).toBe("booking_create.rejected")
    expect(event.data.reason).toBe("payload_resolver_mismatch")
    expect(event.data.productId).toBe(productId)
    expect(event.data.mismatchCount).toBeGreaterThan(0)
    expect(event.data.createdByUserId).toBe("usrp_tester")
    expect(event.metadata).toMatchObject({ category: "internal", source: "service" })
  })

  it("keeps accepting legacy age-banded item lines without traveler assignment metadata", async () => {
    const { productId, unitId, childUnitId, infantUnitId } = await seedProduct({
      ageBandedUnits: true,
    })

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
        },
        {
          firstName: "Infant",
          lastName: "Traveler",
          participantType: "traveler",
        },
      ],
      itemLines: [
        {
          optionUnitId: unitId,
          quantity: 1,
          title: "Adult",
        },
        {
          optionUnitId: childUnitId,
          quantity: 1,
          title: "Child",
        },
        {
          optionUnitId: infantUnitId,
          quantity: 1,
          title: "Infant",
        },
      ],
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return

    const itemRows = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, outcome.result.booking.id))
    expect(itemRows.map((item) => [item.optionUnitId, item.quantity])).toEqual([
      [unitId, 1],
      [childUnitId, 1],
      [infantUnitId, 1],
    ])
  })

  it("redeems travel credit and decrements remaining balance", async () => {
    const { productId } = await seedProduct()
    const travelCredit = await seedTravelCredit({ remainingAmountCents: 25000 })

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      travelCreditRedemption: {
        travelCreditId: travelCredit.id,
        amountCents: 10000,
      },
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return
    expect(outcome.result.travelCreditRedemption?.travelCredit.remainingAmountCents).toBe(15000)
    expect(outcome.result.travelCreditRedemption?.redemption.amountCents).toBe(10000)

    const [updatedTravelCredit] = await db
      .select()
      .from(travelCredits)
      .where(eq(travelCredits.id, travelCredit.id))
    expect(updatedTravelCredit?.remainingAmountCents).toBe(15000)

    const redemptionRows = await db
      .select()
      .from(travelCreditRedemptions)
      .where(eq(travelCreditRedemptions.travelCreditId, travelCredit.id))
    expect(redemptionRows).toHaveLength(1)
    expect(redemptionRows[0]?.bookingId).toBe(outcome.result.booking.id)
  })

  it("rolls back booking + travelers when travel credit has insufficient balance", async () => {
    const { productId } = await seedProduct()
    const travelCredit = await seedTravelCredit({ remainingAmountCents: 500 })

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
      travelCreditRedemption: { travelCreditId: travelCredit.id, amountCents: 2000 },
    })

    expect(outcome.status).toBe("travel_credit_insufficient_balance")
    expect(await db.select().from(bookings)).toHaveLength(0)
    expect(await db.select().from(bookingTravelers)).toHaveLength(0)
    expect(await db.select().from(bookingPaymentSchedules)).toHaveLength(0)

    // Travel credit balance untouched.
    const [same] = await db
      .select()
      .from(travelCredits)
      .where(eq(travelCredits.id, travelCredit.id))
    expect(same?.remainingAmountCents).toBe(500)
  })

  it("returns travel_credit_not_found for an unknown travel credit", async () => {
    const { productId } = await seedProduct()

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      travelCreditRedemption: { travelCreditId: "vchr_missing", amountCents: 1000 },
    })

    expect(outcome.status).toBe("travel_credit_not_found")
    expect(await db.select().from(bookings)).toHaveLength(0)
  })

  it("returns travel_credit_inactive for a non-active travel credit", async () => {
    const { productId } = await seedProduct()
    const travelCredit = await seedTravelCredit({ status: "void" })

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      travelCreditRedemption: { travelCreditId: travelCredit.id, amountCents: 1000 },
    })
    expect(outcome.status).toBe("travel_credit_inactive")
  })

  it("returns travel_credit_expired for past expiresAt", async () => {
    const { productId } = await seedProduct()
    const travelCredit = await seedTravelCredit({ expiresAt: new Date("2020-01-01") })

    const outcome = await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      travelCreditRedemption: { travelCreditId: travelCredit.id, amountCents: 1000 },
    })
    expect(outcome.status).toBe("travel_credit_expired")
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

  it("leaves payment_instruments untouched when travel credit orchestration runs", async () => {
    // Regression guard: travel credit redemption must not mutate payment instruments;
    // the new orchestrator should never write to it.
    const { productId } = await seedProduct()
    const travelCredit = await seedTravelCredit({ remainingAmountCents: 20000 })

    await createBooking(db, {
      productId,
      bookingNumber: nextBookingNumber(),
      ...bookingParty(),
      travelCreditRedemption: { travelCreditId: travelCredit.id, amountCents: 5000 },
    })

    expect(await db.select().from(paymentInstruments)).toHaveLength(0)
  })
})

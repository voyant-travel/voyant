import { actionLedgerEntries } from "@voyant-travel/action-ledger/schema"
import { bookingGroupMembers, bookingGroups, bookings } from "@voyant-travel/bookings/schema"
import { createEventBus } from "@voyant-travel/core"
import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { travelCredits } from "../../src/schema.js"
import { dualCreateBooking } from "../../src/service-bookings-dual-create.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

async function resetTables(
  // biome-ignore lint/suspicious/noExplicitAny: test db -- owner: finance; existing suppression is intentional pending typed cleanup.
  db: any,
) {
  const tableNames = [
    "action_ledger_entries",
    "travel_credit_redemptions",
    "travel_credits",
    "payment_instruments",
    "booking_payment_schedules",
    "booking_allocations",
    "booking_travelers",
    "booking_group_members",
    "booking_groups",
    "booking_supplier_statuses",
    "booking_items",
    "bookings",
    "option_units",
    "product_day_services",
    "product_days",
    "product_itineraries",
    "product_ticket_settings",
    "product_options",
    "products",
  ]
  const existing = (await db.execute<{ tablename: string }>(sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN (${sql.join(
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      tableNames.map((n) => sql`${n}`),
      sql`, `,
    )})
  `)) as Array<{ tablename: string }>
  if (existing.length === 0) return
  const names = existing.map((r) => `"${r.tablename}"`).join(", ")
  await db.execute(sql.raw(`TRUNCATE ${names} CASCADE`))
}

let seq = 0
function seqId(prefix: string) {
  seq += 1
  return `${prefix}_dual_${seq}`
}

describe.skipIf(!DB_AVAILABLE)("dualCreateBooking", () => {
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

  async function seedProduct() {
    const productId = seqId("prod")
    const optionId = seqId("popt")
    const unitId = seqId("opun")
    const itineraryId = seqId("piti")
    await db.execute(sql`
      INSERT INTO products (id, name, sell_currency, sell_amount_cents, cost_amount_cents, margin_percent, start_date, end_date, pax)
      VALUES (${productId}, 'Dual Create', 'EUR', 50000, 30000, 40, '2026-07-01', '2026-07-03', 2)
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
      VALUES (${seqId("ptix")}, ${productId}, 'per_item', 'qr_code', false)
    `)
    return { productId, optionId, unitId }
  }

  it("creates two bookings, one shared group, and two memberships atomically", async () => {
    const { productId, unitId } = await seedProduct()

    const outcome = await dualCreateBooking(db, {
      primary: {
        productId,
        bookingNumber: "BK-DUAL-P-1",
        internalNotes: "Primary traveler",
      },
      secondary: {
        productId,
        bookingNumber: "BK-DUAL-S-1",
        internalNotes: "Room-sharing partner",
      },
      group: {
        kind: "shared_room",
        label: "Shared double — demo",
        optionUnitId: unitId,
      },
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return
    expect(outcome.result.primary.booking.bookingNumber).toBe("BK-DUAL-P-1")
    expect(outcome.result.secondary.booking.bookingNumber).toBe("BK-DUAL-S-1")
    expect(outcome.result.group.primaryBookingId).toBe(outcome.result.primary.booking.id)
    expect(outcome.result.primaryMember.role).toBe("primary")
    expect(outcome.result.secondaryMember.role).toBe("shared")

    expect(await db.select().from(bookings)).toHaveLength(2)
    expect(await db.select().from(bookingGroups)).toHaveLength(1)
    const memberRows = await db
      .select()
      .from(bookingGroupMembers)
      .where(eq(bookingGroupMembers.groupId, outcome.result.group.id))
    expect(memberRows).toHaveLength(2)
  })

  it("writes booking.create ledger entries for both sub-bookings", async () => {
    const { productId } = await seedProduct()

    const outcome = await dualCreateBooking(
      db,
      {
        primary: {
          productId,
          bookingNumber: "BK-DUAL-LEDGER-P",
          internalNotes: "Primary traveler",
        },
        secondary: {
          productId,
          bookingNumber: "BK-DUAL-LEDGER-S",
          internalNotes: "Room-sharing partner",
        },
        group: { kind: "shared_room" },
      },
      {
        userId: "user_dual_create_ledger",
        runtime: {
          actionLedgerContext: {
            userId: "user_dual_create_ledger",
            callerType: "session",
            actor: "staff",
          },
          actionLedgerAuthorizationSource: "booking.create.route",
        },
      },
    )

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return

    const ledgerRows = await db
      .select()
      .from(actionLedgerEntries)
      .where(eq(actionLedgerEntries.actionName, "booking.create"))

    expect(ledgerRows).toHaveLength(2)
    expect(ledgerRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionKind: "create",
          status: "succeeded",
          targetType: "booking",
          targetId: outcome.result.primary.booking.id,
          principalType: "user",
          principalId: "user_dual_create_ledger",
          actorType: "staff",
          routeOrToolName: "booking.create",
          authorizationSource: "booking.create.route",
        }),
        expect.objectContaining({
          actionKind: "create",
          status: "succeeded",
          targetType: "booking",
          targetId: outcome.result.secondary.booking.id,
          principalType: "user",
          principalId: "user_dual_create_ledger",
          actorType: "staff",
          routeOrToolName: "booking.create",
          authorizationSource: "booking.create.route",
        }),
      ]),
    )
  })

  it("rolls back both bookings and the group when the second travel credit is invalid", async () => {
    const { productId } = await seedProduct()
    // Travel credit that exists but has zero balance; the secondary redeem attempt
    // will abort.
    const [travelCredit] = await db
      .insert(travelCredits)
      .values({
        code: "DUAL-ZERO",
        currency: "EUR",
        initialAmountCents: 0,
        remainingAmountCents: 0,
        status: "redeemed",
        sourceType: "manual",
      })
      .returning()

    const outcome = await dualCreateBooking(db, {
      primary: {
        productId,
        bookingNumber: "BK-DUAL-P-ROLLBACK",
      },
      secondary: {
        productId,
        bookingNumber: "BK-DUAL-S-ROLLBACK",
        travelCreditRedemption: { travelCreditId: travelCredit!.id, amountCents: 100 },
      },
      group: { kind: "shared_room" },
    })

    expect(outcome.status).toBe("secondary_failed")
    if (outcome.status !== "secondary_failed") return
    expect(outcome.reason.status).toBe("travel_credit_inactive")

    // Nothing should have landed — primary's inner savepoint committed but
    // the outer tx aborts on the DualCreateAbort throw, so both bookings
    // disappear with the group.
    expect(await db.select().from(bookings)).toHaveLength(0)
    expect(await db.select().from(bookingGroups)).toHaveLength(0)
    expect(await db.select().from(bookingGroupMembers)).toHaveLength(0)
  })

  it("rolls back when the primary booking fails up-front (unknown product)", async () => {
    await seedProduct()

    const outcome = await dualCreateBooking(db, {
      primary: {
        productId: "prod_missing",
        bookingNumber: "BK-DUAL-P-NOPROD",
      },
      secondary: {
        productId: (await seedProduct()).productId,
        bookingNumber: "BK-DUAL-S-NOPROD",
      },
      group: { kind: "shared_room" },
    })

    expect(outcome.status).toBe("primary_failed")
    if (outcome.status !== "primary_failed") return
    expect(outcome.reason.status).toBe("product_not_found")
    expect(await db.select().from(bookings)).toHaveLength(0)
    expect(await db.select().from(bookingGroups)).toHaveLength(0)
  })

  it("applies travel credits and travelers on both sub-bookings", async () => {
    const { productId } = await seedProduct()
    const [travelCreditA] = await db
      .insert(travelCredits)
      .values({
        code: "DUAL-A",
        currency: "EUR",
        initialAmountCents: 10000,
        remainingAmountCents: 10000,
        status: "active",
        sourceType: "manual",
      })
      .returning()
    const [travelCreditB] = await db
      .insert(travelCredits)
      .values({
        code: "DUAL-B",
        currency: "EUR",
        initialAmountCents: 5000,
        remainingAmountCents: 5000,
        status: "active",
        sourceType: "manual",
      })
      .returning()

    const outcome = await dualCreateBooking(db, {
      primary: {
        productId,
        bookingNumber: "BK-DUAL-PAIR-P",
        travelers: [
          { firstName: "Ana", lastName: "Primary", participantType: "traveler", isPrimary: true },
        ],
        travelCreditRedemption: { travelCreditId: travelCreditA!.id, amountCents: 4000 },
      },
      secondary: {
        productId,
        bookingNumber: "BK-DUAL-PAIR-S",
        travelers: [
          { firstName: "Bob", lastName: "Secondary", participantType: "traveler", isPrimary: true },
        ],
        travelCreditRedemption: { travelCreditId: travelCreditB!.id, amountCents: 2000 },
      },
      group: { kind: "shared_room" },
    })

    expect(outcome.status).toBe("ok")
    if (outcome.status !== "ok") return

    const [primaryTravelCredit] = await db
      .select()
      .from(travelCredits)
      .where(eq(travelCredits.id, travelCreditA!.id))
    const [secondaryTravelCredit] = await db
      .select()
      .from(travelCredits)
      .where(eq(travelCredits.id, travelCreditB!.id))
    expect(primaryTravelCredit?.remainingAmountCents).toBe(6000)
    expect(secondaryTravelCredit?.remainingAmountCents).toBe(3000)

    expect(outcome.result.primary.travelers[0]?.firstName).toBe("Ana")
    expect(outcome.result.secondary.travelers[0]?.firstName).toBe("Bob")
  })

  it("emits booking.dual-created event after commit when runtime provided", async () => {
    const { productId } = await seedProduct()
    const eventBus = createEventBus()
    const received: unknown[] = []
    eventBus.subscribe("booking.dual-created", (envelope) => {
      received.push(envelope)
    })

    const outcome = await dualCreateBooking(
      db,
      {
        primary: { productId, bookingNumber: "BK-DUAL-EVT-P" },
        secondary: { productId, bookingNumber: "BK-DUAL-EVT-S" },
        group: { kind: "shared_room" },
      },
      { runtime: { eventBus }, userId: "usrp_dual" },
    )

    expect(outcome.status).toBe("ok")
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(received).toHaveLength(1)
    const envelope = received[0] as {
      name: string
      data: { primaryBookingId: string; secondaryBookingId: string; createdByUserId: string | null }
    }
    expect(envelope.name).toBe("booking.dual-created")
    expect(envelope.data.createdByUserId).toBe("usrp_dual")
  })
})

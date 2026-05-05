import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { availabilitySlotsRef } from "../../src/availability-ref.js"
import { productsRef } from "../../src/products-ref.js"
import { bookingAllocations, bookings } from "../../src/schema.js"
import { bookingsService } from "../../src/service.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

let seq = 0
function nextBookingNumber() {
  seq += 1
  return `BK-HOLD-${String(seq).padStart(6, "0")}`
}

describe.skipIf(!DB_AVAILABLE)("booking hold policy", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test db helper type is loaded dynamically
  let db: any

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
    await ensurePolicyTables()
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyantjs/db/test-utils")
    await closeTestDb()
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
    await ensurePolicyTables()
  })

  async function ensurePolicyTables() {
    await db.execute(sql`
      create table if not exists suppliers (
        id text primary key,
        name text not null,
        type text not null,
        status text not null default 'active',
        reservation_timeout_minutes integer
      )
    `)
    await db.execute(sql`
      create table if not exists products (
        id text primary key,
        name text not null,
        status text not null default 'active',
        description text,
        visibility text not null default 'public',
        activated boolean not null default true,
        reservation_timeout_minutes integer,
        sell_currency text not null default 'EUR',
        sell_amount_cents integer,
        cost_amount_cents integer,
        margin_percent integer,
        supplier_id text,
        start_date date,
        end_date date,
        pax integer
      )
    `)
    await db.execute(sql`
      create table if not exists availability_slots (
        id text primary key,
        product_id text not null,
        option_id text,
        facility_id text,
        availability_rule_id text,
        start_time_id text,
        date_local date not null,
        starts_at timestamptz not null,
        ends_at timestamptz,
        timezone text not null,
        status text not null,
        unlimited boolean not null,
        initial_pax integer,
        remaining_pax integer,
        initial_pickups integer,
        remaining_pickups integer,
        remaining_resources integer,
        past_cutoff boolean not null default false,
        too_early boolean not null default false,
        nights integer,
        days integer,
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `)
  }

  async function seedSupplier(timeoutMinutes: number | null) {
    const id = `sup_hold_${seq}_${timeoutMinutes ?? "inherit"}`
    await db.execute(sql`
      insert into suppliers (id, name, type, status, reservation_timeout_minutes)
      values (${id}, ${`Supplier ${seq}`}, 'experience', 'active', ${timeoutMinutes})
    `)
    return id
  }

  async function seedProduct(timeoutMinutes: number | null, supplierId?: string | null) {
    const [product] = await db
      .insert(productsRef)
      .values({
        name: `Product ${seq}`,
        status: "active",
        visibility: "public",
        activated: true,
        reservationTimeoutMinutes: timeoutMinutes,
        sellCurrency: "EUR",
        supplierId: supplierId ?? null,
      })
      .returning()
    return product
  }

  async function seedSlot(productId: string, remainingPax = 10) {
    const [slot] = await db
      .insert(availabilitySlotsRef)
      .values({
        productId,
        optionId: "opt_hold",
        dateLocal: "2026-06-01",
        startsAt: new Date("2026-06-01T09:00:00.000Z"),
        endsAt: new Date("2026-06-01T11:00:00.000Z"),
        timezone: "Europe/Bucharest",
        status: "open",
        unlimited: false,
        initialPax: remainingPax,
        remainingPax,
      })
      .returning()
    return slot
  }

  function reservePayload(slotId: string, productId: string, quantity = 1) {
    return {
      bookingNumber: nextBookingNumber(),
      sellCurrency: "EUR",
      sourceType: "manual" as const,
      items: [
        {
          title: "Seat",
          itemType: "unit" as const,
          quantity,
          sellCurrency: "EUR",
          allocationType: "unit" as const,
          availabilitySlotId: slotId,
          productId,
        },
      ],
    }
  }

  it("uses product timeout before supplier/default", async () => {
    const supplierId = await seedSupplier(20)
    const product = await seedProduct(7, supplierId)
    const slot = await seedSlot(product.id)

    const before = Date.now()
    const result = await bookingsService.reserveBooking(db, reservePayload(slot.id, product.id))
    const after = Date.now()

    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    const expiresAt = result.booking.holdExpiresAt?.getTime() ?? 0
    expect(expiresAt).toBeGreaterThanOrEqual(before + 7 * 60 * 1000)
    expect(expiresAt).toBeLessThanOrEqual(after + 7 * 60 * 1000 + 1000)
  })

  it("uses supplier timeout when product timeout is inherited", async () => {
    const supplierId = await seedSupplier(12)
    const product = await seedProduct(null, supplierId)
    const slot = await seedSlot(product.id)

    const before = Date.now()
    const result = await bookingsService.reserveBooking(db, reservePayload(slot.id, product.id))
    const after = Date.now()

    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    const expiresAt = result.booking.holdExpiresAt?.getTime() ?? 0
    expect(expiresAt).toBeGreaterThanOrEqual(before + 12 * 60 * 1000)
    expect(expiresAt).toBeLessThanOrEqual(after + 12 * 60 * 1000 + 1000)
  })

  it("expires awaiting-payment bookings and releases capacity", async () => {
    const product = await seedProduct(null)
    const slot = await seedSlot(product.id, 1)
    const result = await bookingsService.reserveBooking(db, {
      ...reservePayload(slot.id, product.id),
      holdExpiresAt: "2020-01-01T00:00:00.000Z",
    })
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return

    await db
      .update(bookings)
      .set({ status: "awaiting_payment" })
      .where(eq(bookings.id, result.booking.id))

    const sweep = await bookingsService.expireStaleBookings(db, {
      before: "2026-12-31T00:00:00.000Z",
    })

    expect(sweep.expiredIds).toContain(result.booking.id)
    const [slotAfter] = await db
      .select({ remainingPax: availabilitySlotsRef.remainingPax })
      .from(availabilitySlotsRef)
      .where(eq(availabilitySlotsRef.id, slot.id))
    expect(slotAfter?.remainingPax).toBe(1)
  })

  it("recovers late paid expired bookings only when capacity can be reserved again", async () => {
    const recoverableProduct = await seedProduct(null)
    const recoverableSlot = await seedSlot(recoverableProduct.id, 2)
    const recoverable = await bookingsService.reserveBooking(db, {
      ...reservePayload(recoverableSlot.id, recoverableProduct.id),
      holdExpiresAt: "2020-01-01T00:00:00.000Z",
    })
    expect(recoverable.status).toBe("ok")
    if (recoverable.status !== "ok") return

    await bookingsService.expireBooking(db, recoverable.booking.id, {})
    const recoveredOk = await bookingsService.recoverExpiredPaidBooking(db, recoverable.booking.id)
    expect(recoveredOk.status).toBe("ok")

    const product = await seedProduct(null)
    const slot = await seedSlot(product.id, 1)
    const result = await bookingsService.reserveBooking(db, {
      ...reservePayload(slot.id, product.id),
      holdExpiresAt: "2020-01-01T00:00:00.000Z",
    })
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return

    await bookingsService.expireBooking(db, result.booking.id, {})

    const competing = await bookingsService.reserveBooking(db, reservePayload(slot.id, product.id))
    expect(competing.status).toBe("ok")

    const recovered = await bookingsService.recoverExpiredPaidBooking(db, result.booking.id)
    expect(recovered.status).toBe("insufficient_capacity")

    const allocations = await db
      .select({ status: bookingAllocations.status })
      .from(bookingAllocations)
      .where(eq(bookingAllocations.bookingId, result.booking.id))
    expect(allocations.every((allocation) => allocation.status === "expired")).toBe(true)
  })
})

import { describe, expect, it, vi } from "vitest"

import { availabilitySlotsRef } from "../../src/availability-ref.js"
import { bookingItemProductDetailsRef, bookingProductDetailsRef } from "../../src/products-ref.js"
import { bookingActivityLog, bookingAllocations, bookingItems, bookings } from "../../src/schema.js"
import { bookingsService, type ConvertProductData } from "../../src/service.js"

const productData: ConvertProductData = {
  product: {
    id: "prod_123",
    name: "Danube departure",
    description: "Scheduled tour",
    sellCurrency: "RON",
    sellAmountCents: 120_000,
    costAmountCents: 80_000,
    marginPercent: 3_333,
    startDate: null,
    endDate: null,
    pax: 2,
  },
  option: { id: "opt_123", name: "Standard" },
  slot: {
    id: "slot_123",
    dateLocal: "2026-06-15",
    startsAt: new Date("2026-06-15T08:00:00.000Z"),
    endsAt: new Date("2026-06-15T16:00:00.000Z"),
    timezone: "Europe/Bucharest",
  },
  dayServices: [],
  units: [
    {
      id: "unit_123",
      optionId: "opt_123",
      name: "Seat",
      description: "Passenger seat",
      unitType: "person",
      isRequired: true,
      minQuantity: null,
      sortOrder: 0,
    },
  ],
}

function asRows(values: Record<string, unknown> | Array<Record<string, unknown>>) {
  return Array.isArray(values) ? values : [values]
}

function makeDb() {
  const insertedBookingAllocations: Array<Record<string, unknown>> = []
  const slotCapacityUpdates: Array<Record<string, unknown>> = []
  const operations: string[] = []

  const db = {
    execute: vi.fn(async () => [
      {
        id: "slot_123",
        product_id: "prod_123",
        option_id: "opt_123",
        date_local: "2026-06-15",
        starts_at: new Date("2026-06-15T08:00:00.000Z"),
        ends_at: new Date("2026-06-15T16:00:00.000Z"),
        timezone: "Europe/Bucharest",
        status: "open",
        unlimited: false,
        remaining_pax: 10,
      },
    ]),
    insert: vi.fn((table) => ({
      values: vi.fn((values: Record<string, unknown> | Array<Record<string, unknown>>) => {
        if (table === bookings) {
          return {
            returning: vi.fn(async () => [
              {
                id: "book_123",
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                ...asRows(values)[0],
              },
            ]),
          }
        }

        if (table === bookingItems) {
          return {
            returning: vi.fn(async () =>
              asRows(values).map((value, index) => ({
                id: `bkit_${index + 1}`,
                notes: null,
                pricingCategoryId: null,
                sourceSnapshotId: null,
                sourceOfferId: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                ...value,
              })),
            ),
          }
        }

        if (table === bookingAllocations) {
          insertedBookingAllocations.push(...asRows(values))
          operations.push("allocation_insert")
          return Promise.resolve(values)
        }

        if (table === bookingProductDetailsRef) {
          return {
            onConflictDoUpdate: vi.fn(async () => undefined),
          }
        }

        if (table === bookingItemProductDetailsRef || table === bookingActivityLog) {
          return Promise.resolve(values)
        }

        return {
          returning: vi.fn(async () => []),
        }
      }),
    })),
    update: vi.fn((table) => ({
      set: vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn(async () => {
          if (table === availabilitySlotsRef) {
            slotCapacityUpdates.push(values)
            operations.push("slot_capacity_update")
          }
        }),
      })),
    })),
  }

  return { db: db as never, insertedBookingAllocations, operations, slotCapacityUpdates }
}

describe("bookingsService.convertProductToBooking", () => {
  it("creates booking allocations for slot-backed booking items", async () => {
    const { db, insertedBookingAllocations, operations, slotCapacityUpdates } = makeDb()

    const booking = await bookingsService.convertProductToBooking(
      db,
      {
        productId: "prod_123",
        optionId: "opt_123",
        slotId: "slot_123",
        bookingNumber: "BK-123",
        initialStatus: "confirmed",
      },
      productData,
      "usr_123",
    )

    expect(booking?.id).toBe("book_123")
    expect(insertedBookingAllocations).toEqual([
      expect.objectContaining({
        bookingId: "book_123",
        bookingItemId: "bkit_1",
        productId: "prod_123",
        optionId: "opt_123",
        optionUnitId: "unit_123",
        availabilitySlotId: "slot_123",
        quantity: 2,
        allocationType: "unit",
        status: "confirmed",
        holdExpiresAt: null,
        metadata: { availabilitySlotId: "slot_123" },
      }),
    ])
    expect(slotCapacityUpdates).toEqual([
      expect.objectContaining({
        remainingPax: 8,
        status: "open",
      }),
    ])
    expect(operations).toEqual(["slot_capacity_update", "allocation_insert"])
  })
})

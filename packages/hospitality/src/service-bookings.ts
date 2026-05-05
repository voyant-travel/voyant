/**
 * Hospitality booking orchestrator — `createStayBooking` writes
 * the booking + booking_item + stay_booking_items + daily rates +
 * travelers in one transaction.
 *
 * Per booking-journey-architecture §10 — the journey's
 * hospitality commit primitive. Mirrors the cruise vertical's
 * `cruisesBookingService.createCruiseBooking` pattern.
 *
 * Inventory: `reserveStay` decrements `room_inventory.availableUnits`
 * and increments `heldUnits` for each night of the stay; the
 * orchestrator inherits that semantics.
 */

import { bookingItems, bookings, bookingsService } from "@voyantjs/bookings"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { hospitalityService, type ReserveStayInput } from "./service.js"

export interface StayBookingPassenger {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  travelerCategory?: "adult" | "child" | "infant" | "senior" | "other" | null
  isPrimary?: boolean | null
  preferredLanguage?: string | null
  specialRequests?: string | null
  notes?: string | null
}

export interface StayBookingContact {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  language?: string | null
  country?: string | null
  region?: string | null
  city?: string | null
  address?: string | null
  postalCode?: string | null
}

export interface CreateStayBookingInput {
  /** Property + room-type pointers. */
  propertyId: string
  roomTypeId: string
  ratePlanId: string
  /** Optional meal plan override. */
  mealPlanId?: string | null
  /** ISO yyyy-MM-dd inclusive check-in. */
  checkInDate: string
  /** ISO yyyy-MM-dd exclusive check-out. */
  checkOutDate: string
  /** Number of rooms reserved (default 1). */
  roomCount?: number
  adults?: number
  children?: number
  infants?: number
  /**
   * Per-night rates. Length must equal `nightCount` between check-in
   * and check-out. The orchestrator forwards these into
   * `reserveStay`.
   */
  dailyRates: ReserveStayInput["dailyRates"]
  /** Lead-contact + party. */
  personId?: string | null
  organizationId?: string | null
  contact: StayBookingContact
  passengers: StayBookingPassenger[]
  notes?: string | null
}

export interface CreateStayBookingResult {
  bookingId: string
  bookingNumber: string
  bookingItemId: string
  stayBookingItemId: string
}

export type CreateStayBookingOutcome =
  | { status: "ok"; result: CreateStayBookingResult }
  | { status: "rate_count_mismatch"; expected: number; received: number }
  | { status: "insufficient_capacity"; date: string; available: number; needed: number }
  | { status: "stop_sell"; date: string }
  | { status: "inventory_missing"; date: string }
  | { status: "no_unit_available" }
  | { status: "room_type_not_found" }

function generateStayBookingNumber(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `HS-${ts}-${rand}`
}

export const hospitalityBookingsService = {
  /**
   * Create a single-room stay booking.
   *
   * Atomic: booking + booking_item + reserveStay (which writes
   * stay_booking_items + stay_daily_rates + decrements room
   * inventory) + travelers — all in one transaction. If any step
   * fails the transaction rolls back.
   */
  async createStayBooking(
    db: PostgresJsDatabase,
    input: CreateStayBookingInput,
    userId?: string,
  ): Promise<CreateStayBookingOutcome> {
    const adults = input.adults ?? input.passengers.length
    const sellAmountCents = input.dailyRates.reduce((sum, r) => sum + (r.sellAmountCents ?? 0), 0)
    const sellCurrency = input.dailyRates[0]?.sellCurrency ?? "EUR"
    const bookingNumber = generateStayBookingNumber()

    return db
      .transaction(async (tx) => {
        // 1. Booking shell. No `productId` — hospitality bookings
        //    point at properties (in @voyantjs/facilities), not
        //    products. The bookings module's plain-text
        //    cross-domain refs make this acceptable.
        const booking = await bookingsService.createBooking(
          tx,
          {
            bookingNumber,
            sellCurrency,
            sellAmountCents,
            status: "draft",
            sourceType: "manual",
            personId: input.personId ?? null,
            organizationId: input.organizationId ?? null,
            contactFirstName: input.contact.firstName,
            contactLastName: input.contact.lastName,
            contactEmail: input.contact.email ?? null,
            contactPhone: input.contact.phone ?? null,
            contactPreferredLanguage: input.contact.language ?? null,
            contactCountry: input.contact.country ?? null,
            contactRegion: input.contact.region ?? null,
            contactCity: input.contact.city ?? null,
            contactAddressLine1: input.contact.address ?? null,
            contactPostalCode: input.contact.postalCode ?? null,
            pax: adults + (input.children ?? 0) + (input.infants ?? 0),
            internalNotes: input.notes ?? null,
          },
          userId,
        )
        if (!booking) throw new Error("bookingsService.createBooking returned null")

        // 2. Booking item — represents the stay line on the booking.
        const [bookingItem] = await tx
          .insert(bookingItems)
          .values({
            bookingId: booking.id,
            title: `Stay at property ${input.propertyId}`,
            itemType: "unit",
            status: "draft",
            quantity: input.roomCount ?? 1,
            sellCurrency,
            totalSellAmountCents: sellAmountCents,
            serviceDate: input.checkInDate,
          })
          .returning()
        if (!bookingItem) throw new Error("booking_items insert returned no rows")

        // 3. reserveStay — writes stay_booking_items + per-night
        //    rates + decrements room inventory. Returns a non-ok
        //    status when inventory is insufficient; we propagate
        //    that out of the tx and let drizzle roll back via the
        //    thrown sentinel.
        const reserveResult = await hospitalityService.reserveStay(tx, {
          bookingItemId: bookingItem.id,
          propertyId: input.propertyId,
          roomTypeId: input.roomTypeId,
          ratePlanId: input.ratePlanId,
          mealPlanId: input.mealPlanId,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          roomCount: input.roomCount,
          adults: input.adults,
          children: input.children,
          infants: input.infants,
          dailyRates: input.dailyRates,
        })

        if (reserveResult.status !== "ok") {
          // Roll back by throwing a typed sentinel — mirrors the
          // pattern used in finance/quickCreateBooking.
          throw new ReserveStayAbort(reserveResult)
        }

        // 4. Travelers.
        for (const passenger of input.passengers) {
          await bookingsService.createTraveler(
            tx,
            booking.id,
            {
              firstName: passenger.firstName,
              lastName: passenger.lastName,
              email: passenger.email ?? null,
              phone: passenger.phone ?? null,
              travelerCategory: passenger.travelerCategory ?? null,
              preferredLanguage: passenger.preferredLanguage ?? null,
              specialRequests: passenger.specialRequests ?? null,
              isPrimary: passenger.isPrimary ?? false,
              notes: passenger.notes ?? null,
            },
            userId,
          )
        }

        return {
          status: "ok" as const,
          result: {
            bookingId: booking.id,
            bookingNumber: booking.bookingNumber,
            bookingItemId: bookingItem.id,
            stayBookingItemId: reserveResult.stayBookingItemId,
          },
        }
      })
      .catch((err) => {
        if (err instanceof ReserveStayAbort) {
          return err.outcome
        }
        throw err
      })
  },
}

class ReserveStayAbort extends Error {
  constructor(readonly outcome: Exclude<CreateStayBookingOutcome, { status: "ok" }>) {
    super(`createStayBooking aborted: ${outcome.status}`)
    this.name = "ReserveStayAbort"
  }
}

// Re-export the bookings table reference so consumers can read the
// shell row by id without importing @voyantjs/bookings directly.
export { bookings as hospitalityBookingsTableRef, eq as hospitalityEq }

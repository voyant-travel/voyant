import { createAccommodationBookingHandler } from "@voyant-travel/accommodations/booking-engine"
import { stayBookingItems, stayDailyRates } from "@voyant-travel/accommodations/schema"
import { getAccommodationContent } from "@voyant-travel/accommodations/service-content"
import {
  bookingActivityLog,
  bookingItems,
  bookingItemTravelers,
  bookings,
  bookingTravelers,
} from "@voyant-travel/bookings/schema"
import type {
  OwnedBookingHandlerRegistry,
  SourceAdapterRegistry,
} from "@voyant-travel/catalog/booking-engine"
import { newId } from "@voyant-travel/db/lib/typeid"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export interface AccommodationBookingRuntimeHost {
  withDatabase<T>(operation: (db: PostgresJsDatabase) => Promise<T>): Promise<T>
  getSourceRegistry(): SourceAdapterRegistry
}

export function registerAccommodationBookingHandler(
  registry: OwnedBookingHandlerRegistry,
  host: AccommodationBookingRuntimeHost,
): void {
  registry.register(
    createAccommodationBookingHandler({
      async loadContent(ctx, entityId) {
        const db = ctx.db as PostgresJsDatabase
        const sourceRegistry = host.getSourceRegistry()
        const resolved = await getAccommodationContent(
          db,
          entityId,
          { preferredLocales: ["en-GB"] },
          { registry: sourceRegistry },
        )
        return resolved?.content ?? null
      },
      async commitBridge(input, opts) {
        return host.withDatabase(async (rawDb) => {
          const db = rawDb as PostgresJsDatabase
          const totalSellAmountCents = input.dailyRates.reduce(
            (sum, rate) => sum + (rate.sellAmountCents ?? 0),
            0,
          )
          const totalCostAmountCents = input.dailyRates.reduce(
            (sum, rate) => sum + (rate.costAmountCents ?? 0),
            0,
          )
          const currency = input.dailyRates[0]?.sellCurrency ?? "GBP"
          const roomCount = input.roomCount ?? 1
          const nightCount = countStayNights(input.checkInDate, input.checkOutDate)
          const bookingNumber = localBookingNumber("ACC")
          const booking = await db.transaction(async (tx) => {
            const [booking] = await tx
              .insert(bookings)
              .values({
                id: newId("bookings"),
                bookingNumber,
                status: "awaiting_payment",
                personId: input.personId ?? null,
                organizationId: input.organizationId ?? null,
                sourceType: "manual",
                contactFirstName: input.contact.firstName,
                contactLastName: input.contact.lastName,
                contactEmail: input.contact.email ?? null,
                contactPhone: input.contact.phone ?? null,
                contactCountry: input.contact.country ?? null,
                sellCurrency: currency,
                sellAmountCents: totalSellAmountCents,
                costAmountCents: totalCostAmountCents > 0 ? totalCostAmountCents : null,
                startDate: input.checkInDate,
                endDate: input.checkOutDate,
                pax: (input.adults ?? 0) + (input.children ?? 0) + (input.infants ?? 0),
                internalNotes: input.notes ?? null,
              })
              .returning({ id: bookings.id, bookingNumber: bookings.bookingNumber })

            if (!booking) throw new Error("accommodation_booking_create_failed")

            await tx.insert(bookingActivityLog).values({
              bookingId: booking.id,
              actorId: opts?.userId ?? "system",
              activityType: "booking_created",
              description: `Booking ${booking.bookingNumber} created`,
            })

            const passengerRows = await tx
              .insert(bookingTravelers)
              .values(
                input.passengers.map((passenger) => ({
                  id: newId("booking_travelers"),
                  bookingId: booking.id,
                  participantType: "traveler" as const,
                  travelerCategory: passenger.travelerCategory ?? null,
                  firstName: passenger.firstName,
                  lastName: passenger.lastName,
                  email: passenger.email ?? null,
                  phone: passenger.phone ?? null,
                  isPrimary: passenger.isPrimary ?? false,
                })),
              )
              .returning({ id: bookingTravelers.id, isPrimary: bookingTravelers.isPrimary })

            const bookingItemId = newId("booking_items")
            await tx.insert(bookingItems).values({
              id: bookingItemId,
              bookingId: booking.id,
              itemType: "unit",
              status: "confirmed",
              title: "Accommodation stay",
              sellCurrency: currency,
              unitSellAmountCents:
                roomCount > 0 ? Math.round(totalSellAmountCents / roomCount) : totalSellAmountCents,
              totalSellAmountCents,
              costCurrency:
                totalCostAmountCents > 0 ? (input.dailyRates[0]?.costCurrency ?? currency) : null,
              unitCostAmountCents:
                totalCostAmountCents > 0 && roomCount > 0
                  ? Math.round(totalCostAmountCents / roomCount)
                  : null,
              totalCostAmountCents: totalCostAmountCents > 0 ? totalCostAmountCents : null,
              quantity: roomCount,
              serviceDate: input.checkInDate,
              startsAt: new Date(`${input.checkInDate}T00:00:00.000Z`),
              endsAt: new Date(`${input.checkOutDate}T00:00:00.000Z`),
              optionUnitId: input.roomTypeId,
              metadata: {
                entityModule: "accommodations",
                propertyId: input.propertyId,
                roomTypeId: input.roomTypeId,
                ratePlanId: input.ratePlanId,
              },
            })

            if (passengerRows.length > 0) {
              await tx.insert(bookingItemTravelers).values(
                passengerRows.map((passenger) => ({
                  id: newId("booking_item_travelers"),
                  bookingItemId,
                  travelerId: passenger.id,
                  role: "traveler" as const,
                  isPrimary: passenger.isPrimary,
                })),
              )
            }

            const stayBookingItemId = newId("stay_booking_items")
            await tx.insert(stayBookingItems).values({
              id: stayBookingItemId,
              bookingItemId,
              propertyId: input.propertyId,
              roomTypeId: input.roomTypeId,
              ratePlanId: input.ratePlanId,
              mealPlanId: input.mealPlanId ?? null,
              checkInDate: input.checkInDate,
              checkOutDate: input.checkOutDate,
              nightCount,
              roomCount,
              adults: input.adults ?? 0,
              children: input.children ?? 0,
              infants: input.infants ?? 0,
              status: "reserved",
              notes: input.notes ?? null,
            })
            await tx.insert(stayDailyRates).values(
              input.dailyRates.map((rate, index) => ({
                id: newId("stay_daily_rates"),
                stayBookingItemId,
                date: addDaysIso(input.checkInDate, index),
                sellCurrency: rate.sellCurrency,
                sellAmountCents: rate.sellAmountCents ?? null,
                costCurrency: rate.costCurrency ?? null,
                costAmountCents: rate.costAmountCents ?? null,
              })),
            )

            return booking
          })

          return {
            status: "ok",
            bookingId: booking.id,
            bookingNumber: booking.bookingNumber,
          }
        })
      },
    }),
  )
}

function countStayNights(checkIn: string, checkOut: string): number {
  const start = Date.parse(`${checkIn}T00:00:00.000Z`)
  const end = Date.parse(`${checkOut}T00:00:00.000Z`)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 1
  return Math.max(1, Math.round((end - start) / 86_400_000))
}

function addDaysIso(date: string, days: number): string {
  const start = Date.parse(`${date}T00:00:00.000Z`)
  const d = new Date(start + days * 86_400_000)
  return d.toISOString().slice(0, 10)
}

function localBookingNumber(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${suffix}`
}

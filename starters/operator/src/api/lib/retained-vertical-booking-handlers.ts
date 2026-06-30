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
import {
  cruiseCabinCategories,
  cruiseSailings,
  cruiseShips,
  cruises,
  cruisesBookingService,
} from "@voyant-travel/cruises"
import { createCruiseBookingHandler } from "@voyant-travel/cruises/booking-engine"
import type { CruiseContent } from "@voyant-travel/cruises/content-shape"
import { getCruiseContent } from "@voyant-travel/cruises/service-content"
import { pricingService as cruisePricingService } from "@voyant-travel/cruises/service-pricing"
import { newId } from "@voyant-travel/db/lib/typeid"
import { bookingPaymentSchedules } from "@voyant-travel/finance"
import { asc, eq } from "drizzle-orm"
import { asPostgresDb } from "./booking-engine-db"
import type { BookingEngineEnv } from "./booking-engine-runtime"
import { withDbFromEnv } from "./db"

export function registerRetainedVerticalBookingHandlers(
  registry: OwnedBookingHandlerRegistry,
  env: BookingEngineEnv,
  getSourceRegistry: () => SourceAdapterRegistry,
): void {
  registry.register(
    createAccommodationBookingHandler({
      async loadContent(ctx, entityId) {
        const db = asPostgresDb(ctx.db)
        const sourceRegistry = getSourceRegistry()
        const resolved = await getAccommodationContent(
          db,
          entityId,
          { preferredLocales: ["en-GB"] },
          { registry: sourceRegistry },
        )
        return resolved?.content ?? null
      },
      async commitBridge(input, opts) {
        return withDbFromEnv(env as Parameters<typeof withDbFromEnv>[0], async (rawDb) => {
          const db = asPostgresDb(rawDb)
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

  registry.register(
    createCruiseBookingHandler({
      async loadContent(ctx, entityId) {
        const db = asPostgresDb(ctx.db)
        const sourceRegistry = getSourceRegistry()
        const resolved = await getCruiseContent(
          db,
          entityId,
          { preferredLocales: ["en-GB"] },
          { registry: sourceRegistry },
        )
        return resolved?.content ?? (await loadLocalCruiseContent(db, entityId))
      },
      async loadPrice(ctx, args) {
        const db = asPostgresDb(ctx.db)
        const row = await cruisePricingService.lowestAvailablePrice(db, {
          sailingId: args.sailingId,
          occupancy: args.occupancy,
        })
        if (!row) return null
        // Match by category — `lowestAvailablePrice` returns the
        // cheapest across categories. When the user has pinned a
        // specific category, narrow the lookup. Phase F+ swaps to
        // a per-(category, occupancy) selector once the wizard
        // surfaces explicit fare-code choice.
        if (args.cabinCategoryId && row.cabinCategoryId !== args.cabinCategoryId) {
          return null
        }
        return {
          pricePerPerson: row.pricePerPerson,
          currency: row.currency,
          fareCode: row.fareCode,
        }
      },
      async commitBridge(input, opts) {
        return withDbFromEnv(env as Parameters<typeof withDbFromEnv>[0], async (rawDb) => {
          const db = asPostgresDb(rawDb)
          try {
            const result = await cruisesBookingService.createCruiseBooking(
              db,
              {
                sailingId: input.sailingId,
                cabinCategoryId: input.cabinCategoryId,
                cabinId: input.cabinId,
                occupancy: input.occupancy,
                fareCode: input.fareCode,
                personId: input.personId,
                organizationId: input.organizationId,
                contact: input.contact,
                passengers: input.passengers,
                airArrangement: input.airArrangement,
                notes: input.notes,
              },
              opts?.userId,
            )

            // Cruise installments (per booking-journey-architecture
            // §7): deposit at book + balance due 90 days before
            // sail. The handler echoes the pricing total via the
            // bridge input's pricing context — for now we read it
            // off the quote stored in cruise_details (the cruise
            // service already snapshotted it). When the journey
            // surfaces explicit installment overrides, they flow
            // through `input.installments` (TBD).
            const totalCents = priceCentsFromString(result.cruiseDetails.quotedTotalForCabin)
            if (totalCents > 0) {
              const depositCents = Math.round(totalCents * 0.25)
              const balanceCents = totalCents - depositCents
              const today = new Date()
              const sailDate = result.cruiseDetails.sailingId
                ? // TODO: resolve sail date from sailings table when wired
                  // — until then balance defaults to today + 60d.
                  null
                : null
              const balanceDue = sailDate ?? new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000)
              const depositDue = today
              await db.insert(bookingPaymentSchedules).values([
                {
                  bookingId: result.bookingId,
                  scheduleType: "deposit",
                  status: "due",
                  dueDate: depositDue.toISOString().slice(0, 10),
                  currency: result.cruiseDetails.quotedCurrency,
                  amountCents: depositCents,
                  notes: "Deposit at booking (per cruise journey §7)",
                },
                {
                  bookingId: result.bookingId,
                  scheduleType: "balance",
                  status: "pending",
                  dueDate: balanceDue.toISOString().slice(0, 10),
                  currency: result.cruiseDetails.quotedCurrency,
                  amountCents: balanceCents,
                  notes: "Balance due before sail",
                },
              ])
            }

            return {
              status: "ok",
              bookingId: result.bookingId,
              bookingNumber: result.bookingNumber,
            }
          } catch (err) {
            return {
              status: "failed",
              reason: err instanceof Error ? err.message : String(err),
            }
          }
        })
      },
    }),
  )
}

async function loadLocalCruiseContent(
  db: ReturnType<typeof asPostgresDb>,
  cruiseId: string,
): Promise<CruiseContent | null> {
  const [cruise] = await db.select().from(cruises).where(eq(cruises.id, cruiseId)).limit(1)
  if (!cruise) return null

  const sailingRows = await db
    .select()
    .from(cruiseSailings)
    .where(eq(cruiseSailings.cruiseId, cruise.id))
    .orderBy(asc(cruiseSailings.departureDate))
  const shipIds = [
    ...new Set(sailingRows.map((sailing) => sailing.shipId).concat(cruise.defaultShipId ?? [])),
  ].filter((id): id is string => Boolean(id))
  const shipRows =
    shipIds.length > 0
      ? await db.select().from(cruiseShips).where(eq(cruiseShips.id, shipIds[0]!)).limit(1)
      : []
  const ship = shipRows[0] ?? null
  const cabinRows = ship
    ? await db
        .select()
        .from(cruiseCabinCategories)
        .where(eq(cruiseCabinCategories.shipId, ship.id))
        .orderBy(asc(cruiseCabinCategories.code))
    : []

  return {
    cruise: {
      id: cruise.id,
      name: cruise.name,
      status: cruise.status,
      description: cruise.description ?? null,
      cruise_type: cruise.cruiseType,
      hero_image_url: cruise.heroImageUrl ?? null,
      highlights: cruise.highlights ?? [],
      cruise_line: null,
      duration_nights: cruise.nights,
      embarkation_port: null,
      disembarkation_port: null,
    },
    ship: ship
      ? {
          name: ship.name,
          description: ship.description ?? null,
          deck_plan_url: ship.deckPlanUrl ?? null,
          deck_plans: [],
          capacity: ship.capacityGuests ?? null,
          decks: ship.deckCount ?? null,
          gallery: ship.gallery ?? [],
        }
      : null,
    sailings: sailingRows.map((sailing) => ({
      id: sailing.id,
      start_date: sailing.departureDate,
      end_date: sailing.returnDate,
      duration_nights: cruise.nights,
      status: sailing.salesStatus,
      embarkation_port: null,
      disembarkation_port: null,
      itinerary_stops: [],
      lowest_price_cents: null,
      currency: null,
    })),
    cabin_categories: cabinRows.map((category) => ({
      id: category.id,
      code: category.code,
      name: category.name,
      description: category.description ?? null,
      type: category.roomType,
      capacity_min: category.minOccupancy,
      capacity_max: category.maxOccupancy,
      amenities: category.amenities ?? [],
      images: category.images ?? [],
      floorplan_images: category.floorplanImages ?? [],
      square_feet: category.squareFeet ?? null,
      grade_codes: category.gradeCodes ?? [],
      wheelchair_accessible: category.wheelchairAccessible,
      inclusions: [],
      feature_codes: category.featureCodes ?? [],
      bed_configurations: [],
      accessibility_features: [],
      view_type: category.viewType ?? null,
    })),
    itinerary_stops: [],
    policies: [],
  }
}

/** Parse a numeric major-unit price string (e.g. cruise_prices'
 *  decimal column shape) into integer cents. */
function priceCentsFromString(s: string): number {
  const negative = s.startsWith("-")
  const abs = negative ? s.slice(1) : s
  const parts = abs.split(".")
  const whole = parts[0] ?? "0"
  const frac = parts[1] ?? ""
  const fracPadded = `${frac}00`.slice(0, 2)
  const cents = Number(whole) * 100 + Number(fracPadded)
  return negative ? -cents : cents
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

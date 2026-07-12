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
import { bookingPaymentSchedules } from "@voyant-travel/finance"
import { asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export interface CruiseBookingRuntimeHost {
  withDatabase<T>(operation: (db: PostgresJsDatabase) => Promise<T>): Promise<T>
  getSourceRegistry(): SourceAdapterRegistry
}
export function registerCruiseBookingHandler(
  registry: OwnedBookingHandlerRegistry,
  host: CruiseBookingRuntimeHost,
): void {
  registry.register(
    createCruiseBookingHandler({
      async loadContent(ctx, entityId) {
        const db = ctx.db as PostgresJsDatabase
        const sourceRegistry = host.getSourceRegistry()
        const resolved = await getCruiseContent(
          db,
          entityId,
          { preferredLocales: ["en-GB"] },
          { registry: sourceRegistry },
        )
        return resolved?.content ?? (await loadLocalCruiseContent(db, entityId))
      },
      async loadPrice(ctx, args) {
        const db = ctx.db as PostgresJsDatabase
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
        return host.withDatabase(async (rawDb) => {
          const db = rawDb as PostgresJsDatabase
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
  db: PostgresJsDatabase,
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

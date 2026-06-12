import { createAccommodationBookingHandler } from "@voyantjs/accommodations/booking-engine"
import { getAccommodationContent } from "@voyantjs/accommodations/service-content"
import type {
  OwnedBookingHandlerRegistry,
  SourceAdapterRegistry,
} from "@voyantjs/catalog/booking-engine"
import { cruisesBookingService } from "@voyantjs/cruises"
import { createCruiseBookingHandler } from "@voyantjs/cruises/booking-engine"
import { getCruiseContent } from "@voyantjs/cruises/service-content"
import { pricingService as cruisePricingService } from "@voyantjs/cruises/service-pricing"
import { bookingPaymentSchedules } from "@voyantjs/finance"
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
    }),
  )

  // Cruises vertical — Phase F skeleton. computeQuote serves the
  // descriptor + per-occupancy pricing from cruise_prices; commit
  // returns failed:not_yet_implemented (cabin allocation +
  // supplier hold + per-installment payment schedule are
  // follow-ups).
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
        return resolved?.content ?? null
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

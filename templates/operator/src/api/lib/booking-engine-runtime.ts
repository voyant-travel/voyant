/**
 * Process-local SourceAdapterRegistry + OwnedBookingHandlerRegistry
 * for the catalog booking engine.
 *
 * Two registries:
 *   - `SourceAdapterRegistry` keyed by connection id — sourced rows
 *     (Voyant Connect peers, GDS, bedbanks, the demo upstream).
 *   - `OwnedBookingHandlerRegistry` keyed by entity module — owned
 *     rows (products vertical in Phase A; hospitality / cruises /
 *     etc. land in subsequent phases against the same interface).
 *
 * Adapters live in their own packages (see `@voyantjs/plugin-catalog-demo`)
 * and are registered conditionally based on the deployment's environment.
 * Owned handlers come from each vertical's `<vertical>/booking-engine`
 * sub-path.
 *
 * Held in module-scope singletons because the registries have process
 * lifetime.
 */

import { availabilitySlots } from "@voyantjs/availability/schema"
import {
  extendAvailabilityHold,
  placeAvailabilityHold,
  releaseAvailabilityHold,
} from "@voyantjs/availability/service-holds"
import { bookingRequirementsService } from "@voyantjs/booking-requirements"
import { bookingItems } from "@voyantjs/bookings/schema"
import {
  createOwnedBookingHandlerRegistry,
  createSourceAdapterRegistry,
  type OwnedBookingHandlerRegistry,
  type SourceAdapterRegistry,
  type TravelerFieldRequirement,
} from "@voyantjs/catalog/booking-engine"
import { cruisesBookingService } from "@voyantjs/cruises"
import { createCruiseBookingHandler } from "@voyantjs/cruises/booking-engine"
import { getCruiseContent } from "@voyantjs/cruises/service-content"
import { pricingService as cruisePricingService } from "@voyantjs/cruises/service-pricing"
import { bookingItemTaxLines, bookingPaymentSchedules, quickCreateBooking } from "@voyantjs/finance"
import { hospitalityBookingsService } from "@voyantjs/hospitality"
import { createHospitalityBookingHandler } from "@voyantjs/hospitality/booking-engine"
import { getHospitalityContent } from "@voyantjs/hospitality/service-content"
import { createDemoCatalogAdapter } from "@voyantjs/plugin-catalog-demo"
import {
  optionPriceRules,
  optionUnitPriceRules,
  priceCatalogs,
  resolveOptionPriceRulesForDate,
} from "@voyantjs/pricing"
import { createProductsBookingHandler } from "@voyantjs/products/booking-engine"
import { optionUnits } from "@voyantjs/products/schema"
import { and, asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import { withDbFromEnv } from "./db"
import { resolveOperatorSellTaxRate } from "./operator-tax-policy"

let _registry: SourceAdapterRegistry | undefined
let _ownedHandlers: OwnedBookingHandlerRegistry | undefined

/**
 * Returns the (lazy-initialized) booking-engine registry. The first
 * caller per process creates the registry and conditionally registers
 * each adapter; subsequent callers get the same instance.
 *
 * Adapter registration is gated on env vars so deployments without an
 * upstream simply don't pre-load that branch.
 */
export function getBookingEngineRegistry(env: BookingEngineEnv): SourceAdapterRegistry {
  if (!_registry) {
    const registry = createSourceAdapterRegistry()
    if (env.CATALOG_DEMO_API_URL) {
      registry.register(createDemoCatalogAdapter({ baseUrl: env.CATALOG_DEMO_API_URL }))
    }
    _registry = registry
  }
  return _registry
}

/**
 * Returns the (lazy-initialized) owned-handler registry. Phase A
 * registers the products vertical only — hospitality, cruises, etc.
 * land here in later phases without changing the dispatch.
 *
 * Per booking-journey-architecture §6.
 */
export function getOwnedBookingHandlerRegistry(env: BookingEngineEnv): OwnedBookingHandlerRegistry {
  if (!_ownedHandlers) {
    const registry = createOwnedBookingHandlerRegistry()
    registry.register(
      createProductsBookingHandler({
        holds: {
          async place(input) {
            return withDbFromEnv(env as Parameters<typeof withDbFromEnv>[0], async (rawDb) => {
              const db = rawDb as unknown as PostgresJsDatabase
              const result = await placeAvailabilityHold(db, input)
              if (result.status === "ok") {
                return {
                  status: "ok",
                  holdToken: result.hold.holdToken,
                  expiresAt: result.hold.expiresAt,
                }
              }
              if (result.status === "slot_unlimited") {
                return {
                  status: "ok",
                  holdToken: result.holdToken,
                  expiresAt: result.expiresAt,
                }
              }
              if (result.status === "slot_not_found") {
                return { status: "slot_not_found" }
              }
              return {
                status: "insufficient_capacity",
                remaining: result.remaining,
                needed: result.needed,
              }
            })
          },
          async extend(input) {
            return withDbFromEnv(env as Parameters<typeof withDbFromEnv>[0], async (rawDb) => {
              const db = rawDb as unknown as PostgresJsDatabase
              const result = await extendAvailabilityHold(db, input)
              if (result.status === "ok") return { status: "ok", expiresAt: result.expiresAt }
              return { status: "not_found" }
            })
          },
          async release(holdToken) {
            await withDbFromEnv(env as Parameters<typeof withDbFromEnv>[0], async (rawDb) => {
              const db = rawDb as unknown as PostgresJsDatabase
              await releaseAvailabilityHold(db, holdToken)
            })
          },
        },
        // Bridge into bookingsQuickCreate. The handler builds the
        // input shape; the bridge provides the transactional commit.
        // env is captured by the closure so the bridge can resolve
        // the per-request DB lazily.
        async quickCreate(input, opts) {
          // `withDbFromEnv` owns the per-call Pool — opens, runs the
          // commit, closes in `finally`. `quickCreateBooking`'s
          // signature still asks for postgres-js; force-cast here since
          // the runtime is neon-serverless on Workers and the drizzle
          // PgDatabase surface is identical across flavors for the
          // ops we use.
          return withDbFromEnv(env as Parameters<typeof withDbFromEnv>[0], async (rawDb) => {
            const db = rawDb as unknown as PostgresJsDatabase
            const outcome = await quickCreateBooking(db, input, opts)
            if (outcome.status === "ok") {
              await persistQuickCreateTaxLines(db, outcome.result.booking.id, input.taxLines)
              return {
                status: "ok",
                bookingId: outcome.result.booking.id,
                bookingNumber: outcome.result.booking.bookingNumber,
              }
            }
            return { status: outcome.status }
          })
        },
        async loadTravelerFields(ctx, productId) {
          // Project booking-requirements rows into the engine's
          // descriptor shape. Per-traveler fields stay; lead-only and
          // booking-scope rows are excluded (they belong on bookingFields).
          const db = ctx.db as unknown as PostgresJsDatabase
          const result = await bookingRequirementsService.listProductContactRequirements(db, {
            productId,
            active: true,
            limit: 100,
            offset: 0,
          })
          const fields: TravelerFieldRequirement[] = []
          for (const row of result.data) {
            if (row.scope !== "traveler" && row.scope !== "lead_traveler") continue
            fields.push({
              key: row.fieldKey,
              label: humanizeFieldKey(row.fieldKey),
              type: typeForFieldKey(row.fieldKey),
              required: row.isRequired,
            })
          }
          // Always include the canonical first/last/email row so the
          // wizard renders something even when no requirements are
          // configured.
          if (!fields.some((f) => f.key === "firstName")) {
            fields.unshift({
              key: "firstName",
              label: "First name",
              type: "text",
              required: true,
            })
          }
          if (!fields.some((f) => f.key === "lastName")) {
            fields.splice(1, 0, {
              key: "lastName",
              label: "Last name",
              type: "text",
              required: true,
            })
          }
          return fields
        },
        async loadTaxRate(ctx, args) {
          void args.buyerCountry
          void args.buyerType
          const db = ctx.db as unknown as PostgresJsDatabase
          return resolveOperatorSellTaxRate(db, { productId: args.productId })
        },
        async loadSlotDate(ctx, slotId) {
          const db = ctx.db as unknown as PostgresJsDatabase
          const [slot] = await db
            .select({ dateLocal: availabilitySlots.dateLocal })
            .from(availabilitySlots)
            .where(eq(availabilitySlots.id, slotId))
            .limit(1)
          return slot?.dateLocal ?? null
        },
        async loadResolvedOptionPrice(ctx, args) {
          const db = ctx.db as unknown as PostgresJsDatabase

          // Resolve catalog id: explicit (rare) > default public.
          let catalogId = args.catalogId
          if (!catalogId) {
            const [cat] = await db
              .select({ id: priceCatalogs.id })
              .from(priceCatalogs)
              .where(
                and(
                  eq(priceCatalogs.catalogType, "public"),
                  eq(priceCatalogs.active, true),
                  eq(priceCatalogs.isDefault, true),
                ),
              )
              .limit(1)
            if (!cat) return null
            catalogId = cat.id
          }

          const ruleByOption = await resolveOptionPriceRulesForDate(db, {
            productId: args.productId,
            optionIds: [args.optionId],
            catalogId,
            date: args.date,
          })
          const rule = ruleByOption.get(args.optionId)
          if (!rule) return null

          const [ruleRow, unitPriceRows, unitRows] = await Promise.all([
            db
              .select({ baseSellAmountCents: optionPriceRules.baseSellAmountCents })
              .from(optionPriceRules)
              .where(eq(optionPriceRules.id, rule.id))
              .limit(1),
            db
              .select({
                unitId: optionUnitPriceRules.unitId,
                sellAmountCents: optionUnitPriceRules.sellAmountCents,
                pricingCategoryId: optionUnitPriceRules.pricingCategoryId,
              })
              .from(optionUnitPriceRules)
              .where(
                and(
                  eq(optionUnitPriceRules.optionPriceRuleId, rule.id),
                  eq(optionUnitPriceRules.active, true),
                ),
              ),
            db
              .select({
                id: optionUnits.id,
                unitType: optionUnits.unitType,
                minAge: optionUnits.minAge,
                maxAge: optionUnits.maxAge,
              })
              .from(optionUnits)
              .where(and(eq(optionUnits.optionId, args.optionId), eq(optionUnits.isHidden, false))),
          ])
          const unitsById = new Map(unitRows.map((u) => [u.id, u]))
          const unitPrices = unitPriceRows.flatMap((up) => {
            const unit = unitsById.get(up.unitId)
            if (!unit) return []
            // Per-category rows (`pricingCategoryId` set) belong to the
            // unit×category matrix used for accommodation products. The
            // booking engine prices per-band today, so we only consume
            // rows where the unit alone determines the price.
            if (up.pricingCategoryId !== null) return []
            return [
              {
                unitId: up.unitId,
                unitType: unit.unitType,
                travelerCategory: deriveTravelerCategory(unit),
                sellAmountCents: up.sellAmountCents,
              },
            ]
          })

          return {
            baseSellAmountCents: ruleRow[0]?.baseSellAmountCents ?? null,
            unitPrices,
          }
        },
      }),
    )
    // Hospitality vertical — Phase B stub. computeQuote serves the
    // descriptor + best-effort pricing from getHospitalityContent;
    // commit returns failed:not_yet_implemented (real
    // stayBookingItems insert is a follow-up).
    //
    // The hospitality content service requires the source-adapter
    // registry (it falls through to the upstream when the cache is
    // stale). We capture `_registry` lazily inside the closure so
    // hot-reloads of the source registry are picked up.
    registry.register(
      createHospitalityBookingHandler({
        async loadContent(ctx, entityId) {
          const db = ctx.db as unknown as PostgresJsDatabase
          const sourceRegistry = getBookingEngineRegistry(env)
          const resolved = await getHospitalityContent(
            db,
            entityId,
            { preferredLocales: ["en-GB"] },
            { registry: sourceRegistry },
          )
          return resolved?.content ?? null
        },
        async commitBridge(input, opts) {
          // The handler validates `ratePlanId` upstream — defensive
          // double-check here would be redundant. `withDbFromEnv` owns
          // the per-call Pool.
          return withDbFromEnv(env as Parameters<typeof withDbFromEnv>[0], async (rawDb) => {
            const db = rawDb as unknown as PostgresJsDatabase
            try {
              const outcome = await hospitalityBookingsService.createStayBooking(
                db,
                {
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
                  personId: input.personId,
                  organizationId: input.organizationId,
                  contact: {
                    firstName: input.contact.firstName,
                    lastName: input.contact.lastName,
                    email: input.contact.email,
                    phone: input.contact.phone,
                    country: input.contact.country,
                  },
                  passengers: input.passengers,
                  notes: input.notes,
                },
                opts?.userId,
              )
              if (outcome.status === "ok") {
                return {
                  status: "ok",
                  bookingId: outcome.result.bookingId,
                  bookingNumber: outcome.result.bookingNumber,
                }
              }
              return { status: "failed", reason: `hospitality_${outcome.status}` }
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

    // Cruises vertical — Phase F skeleton. computeQuote serves the
    // descriptor + per-occupancy pricing from cruise_prices; commit
    // returns failed:not_yet_implemented (cabin allocation +
    // supplier hold + per-installment payment schedule are
    // follow-ups).
    registry.register(
      createCruiseBookingHandler({
        async loadContent(ctx, entityId) {
          const db = ctx.db as unknown as PostgresJsDatabase
          const sourceRegistry = getBookingEngineRegistry(env)
          const resolved = await getCruiseContent(
            db,
            entityId,
            { preferredLocales: ["en-GB"] },
            { registry: sourceRegistry },
          )
          return resolved?.content ?? null
        },
        async loadPrice(ctx, args) {
          const db = ctx.db as unknown as PostgresJsDatabase
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
            const db = rawDb as unknown as PostgresJsDatabase
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

    _ownedHandlers = registry
  }
  return _ownedHandlers
}

export interface BookingEngineEnv {
  CATALOG_DEMO_API_URL?: string
}

async function persistQuickCreateTaxLines(
  db: PostgresJsDatabase,
  bookingId: string,
  taxLines:
    | Array<{
        code?: string | null
        name: string
        jurisdiction?: string | null
        scope?: "included" | "excluded" | "withheld"
        currency: string
        amountCents: number
        rateBasisPoints?: number | null
        includedInPrice?: boolean
        remittanceParty?: string | null
        sortOrder?: number
      }>
    | undefined,
) {
  if (!taxLines?.length) return
  const items = await db
    .select({
      id: bookingItems.id,
      totalSellAmountCents: bookingItems.totalSellAmountCents,
    })
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, bookingId))
    .orderBy(asc(bookingItems.createdAt))
  if (!items.length) return

  const total = items.reduce((sum, item) => sum + (item.totalSellAmountCents ?? 0), 0)
  const rows = taxLines.flatMap((taxLine) =>
    distributeTaxLine(taxLine.amountCents, items, total).map(({ itemId, amountCents }) => ({
      bookingItemId: itemId,
      code: taxLine.code ?? null,
      name: taxLine.name,
      jurisdiction: taxLine.jurisdiction ?? null,
      scope: taxLine.scope ?? (taxLine.includedInPrice ? "included" : "excluded"),
      currency: taxLine.currency,
      amountCents,
      rateBasisPoints: taxLine.rateBasisPoints ?? null,
      includedInPrice: taxLine.includedInPrice ?? taxLine.scope === "included",
      remittanceParty: taxLine.remittanceParty ?? null,
      sortOrder: taxLine.sortOrder ?? 0,
    })),
  )
  if (rows.length) await db.insert(bookingItemTaxLines).values(rows)
}

function distributeTaxLine(
  amountCents: number,
  items: Array<{ id: string; totalSellAmountCents: number | null }>,
  totalCents: number,
) {
  if (items.length === 1 || totalCents <= 0) {
    return [{ itemId: items[0]!.id, amountCents }]
  }
  let remaining = amountCents
  return items.map((item, index) => {
    const isLast = index === items.length - 1
    const allocated = isLast
      ? remaining
      : Math.round(amountCents * ((item.totalSellAmountCents ?? 0) / totalCents))
    remaining -= allocated
    return { itemId: item.id, amountCents: allocated }
  })
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

/**
 * Map an `optionUnits` row to one of the booking-engine's pax-band
 * codes. Operators don't tag units with explicit categories; the
 * mapping is derived from age windows. Heuristic:
 *
 *   - non-person units → null (rooms / vehicles / services don't
 *     participate in per-pax pricing)
 *   - `maxAge ≤ 1` → `infant`
 *   - `maxAge ≤ 17` → `child` (covers operators who tag teens as
 *     "Child 6-12" or similar — the booking engine still treats them
 *     as the child band)
 *   - otherwise → `adult`
 *
 * `senior` requires an explicit pax band, which the default
 * `DEFAULT_PAX_BANDS` does not include — operators that need it
 * extend the bands per product.
 */
function deriveTravelerCategory(unit: {
  unitType: string
  minAge: number | null
  maxAge: number | null
}): "adult" | "child" | "infant" | "senior" | null {
  if (unit.unitType !== "person") return null
  if (unit.maxAge !== null && unit.maxAge <= 1) return "infant"
  if (unit.maxAge !== null && unit.maxAge <= 17) return "child"
  return "adult"
}

function humanizeFieldKey(key: string): string {
  switch (key) {
    case "first_name":
      return "First name"
    case "last_name":
      return "Last name"
    case "date_of_birth":
      return "Date of birth"
    case "passport_number":
      return "Passport number"
    case "passport_expiry":
      return "Passport expiry"
    case "dietary_requirements":
      return "Dietary requirements"
    case "accessibility_needs":
      return "Accessibility needs"
    case "special_requests":
      return "Special requests"
    default:
      return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  }
}

function typeForFieldKey(key: string): string {
  switch (key) {
    case "date_of_birth":
    case "passport_expiry":
      return "date"
    case "email":
      return "email"
    case "phone":
      return "phone"
    case "address":
      return "text"
    default:
      return "text"
  }
}

/**
 * Convenience helper for route handlers — pulls env from the Hono
 * context and returns the (cached) registry.
 */
export function getBookingEngineRegistryFromContext(c: Context): SourceAdapterRegistry {
  const env = c.env as BookingEngineEnv
  return getBookingEngineRegistry(env)
}

/**
 * Convenience helper for route handlers — pulls env from the Hono
 * context and returns the (cached) owned-handler registry.
 */
export function getOwnedBookingHandlerRegistryFromContext(c: Context): OwnedBookingHandlerRegistry {
  const env = c.env as BookingEngineEnv
  return getOwnedBookingHandlerRegistry(env)
}

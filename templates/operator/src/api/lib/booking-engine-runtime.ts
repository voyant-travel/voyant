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

import { bookingRequirementsService } from "@voyantjs/booking-requirements"
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
import { quickCreateBooking, taxClasses, taxRegimes } from "@voyantjs/finance"
import { hospitalityBookingsService } from "@voyantjs/hospitality"
import { createHospitalityBookingHandler } from "@voyantjs/hospitality/booking-engine"
import { getHospitalityContent } from "@voyantjs/hospitality/service-content"
import { createDemoCatalogAdapter } from "@voyantjs/plugin-catalog-demo"
import { createProductsBookingHandler } from "@voyantjs/products/booking-engine"
import { products as productsTable } from "@voyantjs/products/schema"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import { getDbFromHyperdrive } from "./db"

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
        // Bridge into bookingsQuickCreate. The handler builds the
        // input shape; the bridge provides the transactional commit.
        // env is captured by the closure so the bridge can resolve
        // the per-request DB lazily.
        async quickCreate(input, opts) {
          // The hyperdrive helper returns a union (postgres-js | neon-http).
          // The operator deploys against postgres-js in every environment
          // we run today; quickCreateBooking's typed signature accepts
          // postgres-js, so we narrow at the call site rather than
          // widening the helper return type.
          const db = getDbFromHyperdrive(
            env as Parameters<typeof getDbFromHyperdrive>[0],
          ) as PostgresJsDatabase
          const outcome = await quickCreateBooking(db, input, opts)
          if (outcome.status === "ok") {
            return {
              status: "ok",
              bookingId: outcome.result.booking.id,
              bookingNumber: outcome.result.booking.bookingNumber,
            }
          }
          return { status: outcome.status }
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
          // Walk: products.tax_class_id → tax_classes.default_regime_id
          // → tax_regimes.rate_percent. Returns null when any link is
          // missing — the engine renders the breakdown without a tax
          // line.
          //
          // The buyer-country axis is not yet enforced (the demo
          // operator runs in a single jurisdiction). Per
          // booking-journey-architecture §9, the per-buyer-country
          // resolution is a follow-up that reads
          // tax_classes.lines[].applies_to.
          //
          // The buyerCountry / buyerType arguments are accepted but
          // currently unused — kept on the signature so the
          // jurisdictional follow-up doesn't change the contract.
          void args.buyerCountry
          void args.buyerType
          const db = ctx.db as unknown as PostgresJsDatabase
          const productRows = await db
            .select({ taxClassId: productsTable.taxClassId })
            .from(productsTable)
            .where(eq(productsTable.id, args.productId))
            .limit(1)
          const taxClassId = productRows[0]?.taxClassId
          if (!taxClassId) return null

          const classRows = await db
            .select({
              defaultRegimeId: taxClasses.defaultRegimeId,
              code: taxClasses.code,
              label: taxClasses.label,
            })
            .from(taxClasses)
            .where(eq(taxClasses.id, taxClassId))
            .limit(1)
          const klass = classRows[0]
          if (!klass?.defaultRegimeId) return null

          const regimeRows = await db
            .select({
              ratePercent: taxRegimes.ratePercent,
              code: taxRegimes.code,
              name: taxRegimes.name,
            })
            .from(taxRegimes)
            .where(eq(taxRegimes.id, klass.defaultRegimeId))
            .limit(1)
          const regime = regimeRows[0]
          if (!regime || regime.ratePercent == null) return null

          return {
            code: `${klass.code}/${regime.code}`,
            label: regime.name,
            rate: regime.ratePercent / 100,
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
          // The journey doesn't yet surface rate-plan choice. The
          // bridge demands a real ratePlanId — when the journey
          // hasn't supplied one, we fail fast with a helpful reason
          // rather than guessing from inventory.
          if (!input.ratePlanId) {
            return {
              status: "failed",
              reason:
                "hospitality_commit_needs_rate_plan: the journey's Accommodation step must surface a rate plan before commit",
            }
          }
          const db = getDbFromHyperdrive(
            env as Parameters<typeof getDbFromHyperdrive>[0],
          ) as PostgresJsDatabase
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
          const db = getDbFromHyperdrive(
            env as Parameters<typeof getDbFromHyperdrive>[0],
          ) as PostgresJsDatabase
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
                notes: input.notes,
              },
              opts?.userId,
            )
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

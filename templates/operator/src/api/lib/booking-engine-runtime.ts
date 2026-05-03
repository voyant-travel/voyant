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
import { quickCreateBooking, taxClasses, taxRegimes } from "@voyantjs/finance"
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

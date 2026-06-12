/**
 * Process-local SourceAdapterRegistry + OwnedBookingHandlerRegistry
 * for the catalog booking engine.
 *
 * agent-quality: file-size exception -- Booking-engine runtime keeps source adapters, owned handlers, and vertical bridges together until each vertical bridge gets its own module boundary.
 *
 * Two registries:
 *   - `SourceAdapterRegistry` keyed by connection id — sourced rows
 *     (Voyant Connect peers, GDS, bedbanks, the demo upstream).
 *   - `OwnedBookingHandlerRegistry` keyed by entity module — owned
 *     rows (products vertical in Phase A; accommodations / cruises /
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

import { createAccommodationBookingHandler } from "@voyantjs/accommodations/booking-engine"
import { getAccommodationContent } from "@voyantjs/accommodations/service-content"
import { availabilitySlots } from "@voyantjs/availability/schema"
import {
  extendAvailabilityHold,
  placeAvailabilityHold,
  releaseAvailabilityHold,
} from "@voyantjs/availability/service-holds"
import { bookingRequirementsService } from "@voyantjs/booking-requirements"
import { bookingItems } from "@voyantjs/bookings/schema"
import {
  type AddonOffer,
  createOwnedBookingHandlerRegistry,
  createSourceAdapterRegistry,
  type OwnedBookingHandlerRegistry,
  type PaxBandDependency,
  type PaxBandSpec,
  type SourceAdapterRegistry,
  type TravelerFieldRequirement,
} from "@voyantjs/catalog/booking-engine"
import { createVoyantConnectSourceAdapter } from "@voyantjs/connect-adapter"
import { cruisesBookingService } from "@voyantjs/cruises"
import { createCruiseBookingHandler } from "@voyantjs/cruises/booking-engine"
import { getCruiseContent } from "@voyantjs/cruises/service-content"
import { pricingService as cruisePricingService } from "@voyantjs/cruises/service-pricing"
import { productExtras } from "@voyantjs/extras/schema"
import {
  bookingItemTaxLines,
  bookingPaymentSchedules,
  createBooking as createFinanceBooking,
  resolveBookingSellTaxRate,
} from "@voyantjs/finance"
import { createDemoCatalogAdapter } from "@voyantjs/plugin-catalog-demo"
import {
  extraPriceRules,
  optionPriceRules,
  optionUnitPriceRules,
  priceCatalogs,
  pricingCategories,
  pricingCategoryDependencies,
  resolveOptionPriceRulesForDate,
} from "@voyantjs/pricing"
import { createProductsBookingHandler } from "@voyantjs/products/booking-engine"
import { optionUnits, productOptions } from "@voyantjs/products/schema"
import { and, asc, eq, inArray, or } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import { resolveBookingTaxSettings } from "../settings"
import {
  createConnectCruiseSourceAdapter,
  skipCruiseConnectDocuments,
} from "./connect-cruise-source"
import { withDbFromEnv } from "./db"
import { createGeoNameResolver } from "./geo-resolver"

let _registry: SourceAdapterRegistry | undefined
let _ownedHandlers: OwnedBookingHandlerRegistry | undefined

function asPostgresDb(db: unknown): PostgresJsDatabase {
  return db as never
}

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
    registerVoyantConnectAdapter(registry, env)
    _registry = registry
  }
  return _registry
}

/**
 * Returns the (lazy-initialized) owned-handler registry. Phase A
 * registers products plus retained resale verticals such as accommodations
 * and cruises.
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
              const db = asPostgresDb(rawDb)
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
              const db = asPostgresDb(rawDb)
              const result = await extendAvailabilityHold(db, input)
              if (result.status === "ok") return { status: "ok", expiresAt: result.expiresAt }
              return { status: "not_found" }
            })
          },
          async release(holdToken) {
            await withDbFromEnv(env as Parameters<typeof withDbFromEnv>[0], async (rawDb) => {
              const db = asPostgresDb(rawDb)
              await releaseAvailabilityHold(db, holdToken)
            })
          },
        },
        // Bridge into bookingsCreate. The handler builds the
        // input shape; the bridge provides the transactional commit.
        // env is captured by the closure so the bridge can resolve
        // the per-request DB lazily.
        async createBooking(input, opts) {
          // `withDbFromEnv` owns the per-call Pool — opens, runs the
          // commit, closes in `finally`. `createFinanceBooking`'s
          // signature still asks for postgres-js; force-cast here since
          // the runtime is neon-serverless on Workers and the drizzle
          // PgDatabase surface is identical across flavors for the
          // ops we use.
          return withDbFromEnv(env as Parameters<typeof withDbFromEnv>[0], async (rawDb) => {
            const db = asPostgresDb(rawDb)
            // `input.initialStatus` is plumbed from the booking-engine
            // commit caller (e.g. trip composer reserve) so bookings land in
            // the operator's preferred state — `awaiting_payment` for live
            // reservations, `draft` when the operator explicitly asks.
            const outcome = await createFinanceBooking(db, input, opts)
            if (outcome.status === "ok") {
              await persistBookingCreateTaxLines(db, outcome.result.booking.id, input.taxLines)
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
          const db = asPostgresDb(ctx.db)
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
        async loadAddonCatalog(ctx, productId) {
          const db = asPostgresDb(ctx.db)
          const rows = await db
            .select({
              id: productExtras.id,
              name: productExtras.name,
              description: productExtras.description,
              selectionType: productExtras.selectionType,
              pricingMode: productExtras.pricingMode,
              pricedPerPerson: productExtras.pricedPerPerson,
              minQuantity: productExtras.minQuantity,
              maxQuantity: productExtras.maxQuantity,
              defaultQuantity: productExtras.defaultQuantity,
            })
            .from(productExtras)
            .where(and(eq(productExtras.productId, productId), eq(productExtras.active, true)))
            .orderBy(asc(productExtras.sortOrder), asc(productExtras.name))

          if (rows.length === 0) return []
          const extraIds = rows.map((row) => row.id)
          const priceRows = await db
            .select({
              productExtraId: extraPriceRules.productExtraId,
              pricingMode: extraPriceRules.pricingMode,
              sellAmountCents: extraPriceRules.sellAmountCents,
              sortOrder: extraPriceRules.sortOrder,
            })
            .from(extraPriceRules)
            .where(
              and(
                inArray(extraPriceRules.productExtraId, extraIds),
                eq(extraPriceRules.active, true),
              ),
            )
            .orderBy(asc(extraPriceRules.sortOrder), asc(extraPriceRules.createdAt))

          const priceByExtraId = new Map(
            priceRows.flatMap((row) =>
              row.productExtraId ? [[row.productExtraId, row] as const] : [],
            ),
          )

          return rows.map((row): AddonOffer => {
            const price = priceByExtraId.get(row.id)
            return {
              id: row.id,
              name: row.name,
              description: row.description,
              kind: "extras",
              pricingMode: price?.pricingMode ?? row.pricingMode,
              unitAmountCents: price?.sellAmountCents ?? null,
              currency: null,
              pricedPerPerson: row.pricedPerPerson,
              selectionType: row.selectionType,
              minQuantity: row.minQuantity,
              maxQuantity: row.maxQuantity,
              defaultQuantity: row.defaultQuantity,
            }
          })
        },
        async loadTaxRate(ctx, args) {
          void args.buyerCountry
          void args.buyerType
          const db = asPostgresDb(ctx.db)
          return resolveBookingSellTaxRate(
            db,
            { productId: args.productId },
            { resolveBookingTaxSettings },
          )
        },
        async loadProductOptions(ctx, productId) {
          const db = asPostgresDb(ctx.db)
          const rows = await db
            .select({
              id: productOptions.id,
              code: productOptions.code,
              name: productOptions.name,
              description: productOptions.description,
              isDefault: productOptions.isDefault,
            })
            .from(productOptions)
            .where(
              and(eq(productOptions.productId, productId), eq(productOptions.status, "active")),
            )
            .orderBy(asc(productOptions.sortOrder), asc(productOptions.createdAt))
          const optionIds = rows.map((row) => row.id)
          const units =
            optionIds.length > 0
              ? await db
                  .select({
                    id: optionUnits.id,
                    optionId: optionUnits.optionId,
                    name: optionUnits.name,
                    description: optionUnits.description,
                    unitType: optionUnits.unitType,
                    minQuantity: optionUnits.minQuantity,
                    maxQuantity: optionUnits.maxQuantity,
                  })
                  .from(optionUnits)
                  .where(
                    and(inArray(optionUnits.optionId, optionIds), eq(optionUnits.isHidden, false)),
                  )
                  .orderBy(asc(optionUnits.sortOrder), asc(optionUnits.createdAt))
              : []
          const unitsByOptionId = new Map<string, typeof units>()
          for (const unit of units) {
            const current = unitsByOptionId.get(unit.optionId) ?? []
            current.push(unit)
            unitsByOptionId.set(unit.optionId, current)
          }
          return rows.map((row) => ({
            id: row.id,
            code: row.code,
            name: row.name,
            description: row.description,
            isDefault: row.isDefault,
            units: unitsByOptionId.get(row.id)?.map((unit) => ({
              id: unit.id,
              name: unit.name,
              description: unit.description,
              unitType: unit.unitType,
              minQuantity: unit.minQuantity,
              maxQuantity: unit.maxQuantity,
            })),
          }))
        },
        async loadPaxBands(ctx, productId) {
          // The journey's traveler bands should be the product's own
          // traveler types ("Adult", "Child under 6") — these live as
          // pricing categories scoped to the product, its options, or its
          // option units (operators add traveler types at any of these
          // levels; "Adult" is often a per-room/base type).
          //
          // Enrichment must never break the quote: on any failure (e.g. a
          // missing migration) we return undefined so the engine falls back
          // to the generic default bands instead of collapsing the shape.
          try {
            const db = asPostgresDb(ctx.db)
            const optionRows = await db
              .select({ id: productOptions.id })
              .from(productOptions)
              .where(
                and(eq(productOptions.productId, productId), eq(productOptions.status, "active")),
              )
            const optionIds = optionRows.map((row) => row.id)
            const unitRows =
              optionIds.length > 0
                ? await db
                    .select({ id: optionUnits.id })
                    .from(optionUnits)
                    .where(inArray(optionUnits.optionId, optionIds))
                : []
            const unitIds = unitRows.map((row) => row.id)

            const scopeClauses = [eq(pricingCategories.productId, productId)]
            if (optionIds.length > 0)
              scopeClauses.push(inArray(pricingCategories.optionId, optionIds))
            if (unitIds.length > 0) scopeClauses.push(inArray(pricingCategories.unitId, unitIds))
            const rows = await db
              .select({
                name: pricingCategories.name,
                categoryType: pricingCategories.categoryType,
                minAge: pricingCategories.minAge,
                maxAge: pricingCategories.maxAge,
              })
              .from(pricingCategories)
              .where(
                and(
                  or(...scopeClauses),
                  eq(pricingCategories.active, true),
                  eq(pricingCategories.internalUseOnly, false),
                ),
              )
              .orderBy(asc(pricingCategories.sortOrder), asc(pricingCategories.name))

            // Only traveler bands — room/vehicle/service/group/other are
            // inventory units, not people.
            const travelerTypes = new Set(["adult", "child", "infant", "senior"])
            const maxByType: Record<string, number> = { adult: 8, child: 6, infant: 4, senior: 8 }
            const orderByType: Record<string, number> = { adult: 0, child: 1, infant: 2, senior: 3 }
            const seen = new Set<string>()
            const bands: PaxBandSpec[] = []
            for (const row of rows) {
              if (!travelerTypes.has(row.categoryType)) continue
              // Pricing matches per-band prices by the traveler-category code,
              // so keep code = categoryType. Dedupe by type (first/lowest
              // sort) while preserving the product's own label.
              if (seen.has(row.categoryType)) continue
              seen.add(row.categoryType)
              bands.push({
                code: row.categoryType,
                label: row.name,
                ...(row.minAge != null ? { minAge: row.minAge } : {}),
                ...(row.maxAge != null ? { maxAge: row.maxAge } : {}),
                minCount: row.categoryType === "adult" ? 1 : 0,
                maxCount: maxByType[row.categoryType] ?? 8,
              })
            }
            // No traveler types configured at all → undefined so the engine
            // keeps the generic adult/child/infant defaults.
            if (bands.length === 0) return undefined
            // Adults are the universal base traveler — a product can define
            // only child/infant add-on types ("Adult" is the room base price,
            // not a category). Guarantee an Adult band so the operator can
            // always add the primary travelers. Its age floor sits just above
            // the highest child band when one is configured.
            if (!seen.has("adult")) {
              const childMaxAge = bands.reduce<number | null>(
                (max, b) => (b.maxAge != null && (max == null || b.maxAge > max) ? b.maxAge : max),
                null,
              )
              bands.push({
                code: "adult",
                label: "Adult",
                ...(childMaxAge != null ? { minAge: childMaxAge + 1 } : {}),
                minCount: 1,
                maxCount: 8,
              })
            }
            bands.sort((a, b) => (orderByType[a.code] ?? 9) - (orderByType[b.code] ?? 9))
            return bands
          } catch (error) {
            console.warn("[booking-engine] loadPaxBands failed; using default bands", error)
            return undefined
          }
        },
        async loadPaxBandDependencies(ctx, productId) {
          // Cross-band occupancy rules ("Child under 6 requires an Adult")
          // are pricing-category dependencies. Resolve the product's
          // traveler categories, then map each dependency's category ids
          // to the pax-band codes the journey validates against.
          //
          // Enrichment must never break the quote — degrade to "no rules"
          // on any failure (e.g. a missing `pricing_category_dependencies`
          // migration) rather than failing the whole booking shape.
          try {
            const db = asPostgresDb(ctx.db)
            const optionRows = await db
              .select({ id: productOptions.id })
              .from(productOptions)
              .where(
                and(eq(productOptions.productId, productId), eq(productOptions.status, "active")),
              )
            const optionIds = optionRows.map((row) => row.id)
            const unitRows =
              optionIds.length > 0
                ? await db
                    .select({ id: optionUnits.id })
                    .from(optionUnits)
                    .where(inArray(optionUnits.optionId, optionIds))
                : []
            const unitIds = unitRows.map((row) => row.id)

            const scopeClauses = [eq(pricingCategories.productId, productId)]
            if (optionIds.length > 0)
              scopeClauses.push(inArray(pricingCategories.optionId, optionIds))
            if (unitIds.length > 0) scopeClauses.push(inArray(pricingCategories.unitId, unitIds))
            const cats = await db
              .select({ id: pricingCategories.id, categoryType: pricingCategories.categoryType })
              .from(pricingCategories)
              .where(and(or(...scopeClauses), eq(pricingCategories.active, true)))
            if (cats.length === 0) return undefined
            const typeById = new Map(cats.map((c) => [c.id, c.categoryType]))

            const deps = await db
              .select({
                dependentId: pricingCategoryDependencies.pricingCategoryId,
                masterId: pricingCategoryDependencies.masterPricingCategoryId,
                dependencyType: pricingCategoryDependencies.dependencyType,
                maxPerMaster: pricingCategoryDependencies.maxPerMaster,
                maxDependentSum: pricingCategoryDependencies.maxDependentSum,
              })
              .from(pricingCategoryDependencies)
              .where(
                and(
                  inArray(
                    pricingCategoryDependencies.pricingCategoryId,
                    cats.map((c) => c.id),
                  ),
                  eq(pricingCategoryDependencies.active, true),
                ),
              )

            const travelerTypes = new Set(["adult", "child", "infant", "senior"])
            const out: PaxBandDependency[] = []
            for (const dep of deps) {
              const dependentCode = typeById.get(dep.dependentId)
              const masterCode = typeById.get(dep.masterId)
              // Both ends must be traveler bands the journey renders, and a
              // band can't depend on itself.
              if (!dependentCode || !masterCode) continue
              if (!travelerTypes.has(dependentCode) || !travelerTypes.has(masterCode)) continue
              if (dependentCode === masterCode) continue
              out.push({
                dependentCode,
                masterCode,
                type: dep.dependencyType,
                ...(dep.maxPerMaster != null ? { maxPerMaster: dep.maxPerMaster } : {}),
                ...(dep.maxDependentSum != null ? { maxDependentSum: dep.maxDependentSum } : {}),
              })
            }
            return out.length > 0 ? out : undefined
          } catch (error) {
            console.warn("[booking-engine] loadPaxBandDependencies failed; skipping rules", error)
            return undefined
          }
        },
        async loadSlotDate(ctx, slotId) {
          const db = asPostgresDb(ctx.db)
          const [slot] = await db
            .select({ dateLocal: availabilitySlots.dateLocal })
            .from(availabilitySlots)
            .where(eq(availabilitySlots.id, slotId))
            .limit(1)
          return slot?.dateLocal ?? null
        },
        async loadResolvedOptionPrice(ctx, args) {
          const db = asPostgresDb(ctx.db)

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
    // Accommodations resale vertical. computeQuote serves the descriptor +
    // best-effort pricing from getAccommodationContent. Commit intentionally
    // has no bridge until the retained resale booking-line write path moves
    // out of the legacy package.
    //
    // The accommodations content service requires the source-adapter
    // registry (it falls through to the upstream when the cache is
    // stale). We capture `_registry` lazily inside the closure so
    // hot-reloads of the source registry are picked up.
    registry.register(
      createAccommodationBookingHandler({
        async loadContent(ctx, entityId) {
          const db = asPostgresDb(ctx.db)
          const sourceRegistry = getBookingEngineRegistry(env)
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

    _ownedHandlers = registry
  }
  return _ownedHandlers
}

export interface BookingEngineEnv {
  CATALOG_DEMO_API_URL?: string
  VOYANT_API_KEY?: string
  VOYANT_CLOUD_API_KEY?: string
  VOYANT_CONNECT_API_KEY?: string
  VOYANT_CONNECT_API_URL?: string
  VOYANT_CONNECT_MARKET?: string
  VOYANT_CONNECT_OPERATOR_ID?: string
  VOYANT_CONNECT_SYNC_LIMIT?: string
}

function registerVoyantConnectAdapter(
  registry: SourceAdapterRegistry,
  env: BookingEngineEnv,
): void {
  const apiKey = env.VOYANT_API_KEY ?? env.VOYANT_CONNECT_API_KEY ?? env.VOYANT_CLOUD_API_KEY
  const operatorId = env.VOYANT_CONNECT_OPERATOR_ID
  if (!apiKey && !operatorId) return

  if (!apiKey || !operatorId) {
    console.warn(
      "[booking-engine] incomplete Voyant Connect config; set VOYANT_API_KEY, " +
        "and VOYANT_CONNECT_OPERATOR_ID to enable it.",
    )
    return
  }

  registry.register(
    createVoyantConnectSourceAdapter({
      connect: {
        apiKey,
        operatorId,
        baseUrl: env.VOYANT_CONNECT_API_URL,
      },
      operatorId,
      market: env.VOYANT_CONNECT_MARKET,
      discoverLimit: positiveInteger(env.VOYANT_CONNECT_SYNC_LIMIT) ?? 500,
      // Cruises are sourced through the structured cruise adapter below so the
      // canonical geography survives; skip them on the generic path.
      mapDocument: skipCruiseConnectDocuments,
    }),
  )

  // Structured cruise sourcing — lands sourced cruises in the cruise vertical
  // with facetable geography (waterways / regions / countries + canonical ids).
  // Also powers `getCruiseContent` detail reads for sourced cruises through the
  // catalog source-adapter registry (external-cruise refresh cron + routes).
  registry.register(
    createConnectCruiseSourceAdapter(
      {
        connect: {
          apiKey,
          operatorId,
          baseUrl: env.VOYANT_CONNECT_API_URL,
        },
        operatorId,
      },
      undefined,
      // Resolve canonical-geography ids → display names (ports/regions/waterways)
      // via Voyant Data geo so the catalog shows resolved names, not raw ids.
      { geo: createGeoNameResolver({ apiKey }) },
    ),
  )
}

function positiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

async function persistBookingCreateTaxLines(
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

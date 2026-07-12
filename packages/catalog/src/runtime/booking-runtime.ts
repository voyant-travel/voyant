import { bookingActivityLog, bookingItems, bookings } from "@voyant-travel/bookings/schema"
import {
  type BookEntityResult,
  type CatalogBookingBookBody,
  type CatalogBookingCommittedEvent,
  type CatalogBookingRouteModuleOptions,
  type CatalogBookingRoutesOptions,
  catalogQuotesTable,
  getOrderById,
  OWNED_SOURCE_KIND,
  type QuoteEntityResult,
} from "@voyant-travel/catalog/booking-engine"
import {
  applyCatalogTaxToQuoteResult,
  buildSourcedBookingRowValues,
  createCatalogPackageHoldPreparer,
  createSourcedBookingNumber,
  resolveCatalogHoldTtlMs,
} from "@voyant-travel/catalog/operator-runtime"
import { createVoyantConnectClient, type PackageOffer } from "@voyant-travel/connect-sdk"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { newId } from "@voyant-travel/db/lib/typeid"
import { computeBookingItemTaxLine, resolveBookingSellTaxRate } from "@voyant-travel/finance"
import type { FinanceOperatorSettingsRuntime } from "@voyant-travel/finance/runtime-port"
import { resolveVoyantConnectEnv } from "@voyant-travel/plugin-voyant-connect"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { requireCatalogRuntimeServices } from "../runtime-contracts.js"
import {
  getBookingEngineRegistryFromContext,
  getOwnedBookingHandlerRegistryFromContext,
} from "./booking-engine-runtime.js"
import { catalogRuntimeExtensions } from "./host.js"

function getCatalogBookingDb(c: Context): AnyDrizzleDb {
  return (c.var as { db: AnyDrizzleDb }).db
}

function createOperatorCatalogBookingRoutesOptions(): CatalogBookingRoutesOptions {
  const { commerce, inventory } = catalogRuntimeExtensions()
  return {
    resolveDb: getCatalogBookingDb,
    resolveSourceRegistry: getBookingEngineRegistryFromContext,
    resolveOwnedHandlers: getOwnedBookingHandlerRegistryFromContext,
    resolveHoldTtlMs: ({ db, entityModule, entityId }) =>
      resolveHoldTtlMs(db, entityModule, entityId),
    // Promotions hook wires the per-request db into the evaluator. When
    // the customer-supplied promotion code fails validation, quoteEntity
    // surfaces a code_* invalidReason and tax recompute below sees no
    // discount on base_amount.
    resolveEvaluatePromotions: commerce.createPromotionEvaluator,
    transformQuoteResult: async ({ c, db, result, request, provenance }) => {
      const taxed = await requireCatalogRuntimeServices().applyTaxToQuoteResult(
        db,
        result,
        request.entityModule,
        request.entityId,
        provenance.sourceKind,
      )
      return inventory.enrichProductQuoteShape({
        db,
        result: taxed,
        entityModule: request.entityModule,
        entityId: request.entityId,
        locale: request.scope?.locale ?? "en-GB",
        market: request.scope?.market ?? "default",
        currency: request.scope?.currency,
        registry: getBookingEngineRegistryFromContext(c),
        adapterContext: {
          connection_id: provenance.sourceConnectionId ?? provenance.sourceKind,
        },
      })
    },
    prepareBookParameters: prepareConnectPackageBookParameters,
    onCommitted: materializeSourcedBookingForCatalogCommit,
    onDraftConsumedError: ({ error }) => {
      console.warn("[catalog-booking] markDraftConsumed failed:", error)
    },
  }
}

export async function materializeSourcedBookingForCatalogCommit({
  c,
  db,
  request,
  result,
}: CatalogBookingCommittedEvent): Promise<void> {
  if (c.req.path.startsWith("/v1/public/")) return

  const snapshot = await getOrderById(db, result.snapshotId)
  if (!snapshot || snapshot.source_kind === OWNED_SOURCE_KIND) return

  const typedDb = db as PostgresJsDatabase
  const [existing] = await typedDb
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.id, result.bookingId))
    .limit(1)
  if (existing) return

  const actorId = typeof c.get("userId") === "string" ? c.get("userId") : "system"
  const rows = buildSourcedBookingRows({ request, result, snapshot, actorId })

  await typedDb.transaction(async (tx) => {
    await tx.insert(bookings).values(rows.booking)
    await tx.insert(bookingItems).values(rows.item)
    await tx.insert(bookingActivityLog).values(rows.activity)
  })
}

export function buildSourcedBookingRows({
  request,
  result,
  snapshot,
  actorId,
}: {
  request: CatalogBookingBookBody
  result: BookEntityResult
  snapshot: NonNullable<Awaited<ReturnType<typeof getOrderById>>>
  actorId: string
}): {
  booking: typeof bookings.$inferInsert
  item: typeof bookingItems.$inferInsert
  activity: typeof bookingActivityLog.$inferInsert
} {
  const rows = buildSourcedBookingRowValues({
    request,
    result,
    snapshot,
    actorId,
    bookingItemId: newId("booking_items"),
    bookingNumber: createSourcedBookingNumber(),
  })
  return {
    booking: rows.booking as typeof bookings.$inferInsert,
    item: rows.item as typeof bookingItems.$inferInsert,
    activity: rows.activity as typeof bookingActivityLog.$inferInsert,
  }
}

const prepareConnectPackageBookParameters = createCatalogPackageHoldPreparer({
  lock: async ({ context, connectionId, offer }) => {
    const c = context as Context
    const config = resolveVoyantConnectEnv(c.env as Record<string, string | undefined>, {
      warn: (message) => console.warn(`[catalog-booking] ${message}`),
    })
    if (!config) return null
    const hold = await createVoyantConnectClient({
      apiKey: config.apiKey,
      operatorId: config.operatorId,
      baseUrl: config.baseUrl,
    }).packages.lock(connectionId, offer as unknown as PackageOffer)
    return hold.id
  },
})

export function createOperatorCatalogBookingRouteModuleOptions(): CatalogBookingRouteModuleOptions {
  const { inventory, operations } = catalogRuntimeExtensions()
  return {
    booking: createOperatorCatalogBookingRoutesOptions(),
    resolveRegistry: getBookingEngineRegistryFromContext,
    getProductContent: inventory.getProductContent,
    listAvailabilitySlots: operations.listAvailabilitySlots,
    getOwnedProductById: inventory.getOwnedProductById,
  }
}

async function resolveHoldTtlMs(
  db: AnyDrizzleDb,
  entityModule: string,
  entityId: string,
): Promise<number> {
  const { distribution, inventory } = catalogRuntimeExtensions()
  return resolveCatalogHoldTtlMs({
    entityModule,
    entityId,
    loadProduct: (id) => inventory.loadProductReservationPolicy(db, id),
    loadSupplier: (id) => distribution.loadSupplierReservationTimeout(db, id),
  })
}

export async function applyOperatorTaxToQuoteResult(
  db: AnyDrizzleDb,
  result: QuoteEntityResult,
  entityModule: string,
  entityId: string,
  sourceKind: string,
  resolveBookingTaxSettings: FinanceOperatorSettingsRuntime["resolveBookingTaxSettings"],
): Promise<QuoteEntityResult> {
  return applyCatalogTaxToQuoteResult({
    result,
    entityModule,
    entityId,
    sourceKind,
    ownedSourceKind: OWNED_SOURCE_KIND,
    resolveTaxLine: async ({ productId, taxableCents, currency }) => {
      const taxRate = await resolveBookingSellTaxRate(
        db as PostgresJsDatabase,
        { productId, facts: { hasAccommodation: false, accommodationCountries: [] } },
        { resolveBookingTaxSettings },
      )
      return computeBookingItemTaxLine(taxRate, taxableCents, currency)
    },
    persistPricing: async (quoteId, pricing) => {
      await (db as PostgresJsDatabase)
        .update(catalogQuotesTable)
        .set({
          pricing_base_amount: String(pricing.base_amount),
          pricing_taxes: String(pricing.taxes),
          pricing_fees: String(pricing.fees),
          pricing_surcharges: String(pricing.surcharges),
          pricing_currency: pricing.currency,
          pricing_breakdown: pricing.breakdown,
        })
        .where(eq(catalogQuotesTable.id, quoteId))
    },
  })
}

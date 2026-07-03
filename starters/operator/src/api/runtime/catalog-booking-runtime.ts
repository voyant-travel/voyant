import { bookingActivityLog, bookingItems, bookings } from "@voyant-travel/bookings/schema"
import {
  type BookEntityResult,
  type CatalogAvailabilitySlotsScope,
  type CatalogBookingBookBody,
  type CatalogBookingCommittedEvent,
  type CatalogBookingMountTarget,
  type CatalogBookingPrepareBookParametersInput,
  type CatalogBookingRouteModuleOptions,
  type CatalogBookingRoutesOptions,
  catalogQuotesTable,
  getOrderById,
  mountCatalogBookingRoutes as mountPackageCatalogBookingRoutes,
  OWNED_SOURCE_KIND,
  type QuoteEntityResult,
  type SlotRow,
} from "@voyant-travel/catalog/booking-engine"
import { createCatalogPromotionEvaluator } from "@voyant-travel/commerce"
import { createVoyantConnectClient, type PackageOffer } from "@voyant-travel/connect-sdk"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { newId } from "@voyant-travel/db/lib/typeid"
import { suppliers } from "@voyant-travel/distribution"
import { computeBookingItemTaxLine, resolveBookingSellTaxRate } from "@voyant-travel/finance"
import { products, productsService } from "@voyant-travel/inventory"
import { getProductContent } from "@voyant-travel/inventory/service-content"
import { availabilitySlots } from "@voyant-travel/operations"
import { resolveBookingTaxSettings } from "@voyant-travel/operator-settings"
import { resolveVoyantConnectEnv } from "@voyant-travel/plugin-voyant-connect"
import { and, asc, eq, gte } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import {
  getBookingEngineRegistryFromContext,
  getOwnedBookingHandlerRegistryFromContext,
} from "../lib/booking-engine-runtime"
import { enrichProductQuoteShape } from "./catalog-booking-shape-enricher"

const DEFAULT_HOLD_TTL_MS = 30 * 60 * 1000

function getCatalogBookingDb(c: Context): AnyDrizzleDb {
  return (c.var as { db: AnyDrizzleDb }).db
}

function createOperatorCatalogBookingRoutesOptions(): CatalogBookingRoutesOptions {
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
    resolveEvaluatePromotions: ({ db }) => createCatalogPromotionEvaluator(db),
    transformQuoteResult: async ({ c, db, result, request, provenance }) => {
      const taxed = await applyOperatorTaxToQuoteResult(
        db,
        result,
        request.entityModule,
        request.entityId,
        provenance.sourceKind,
      )
      return enrichProductQuoteShape({
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
  // Storefront checkout has its own richer materializer after /checkout/start
  // that reads the consumed draft and writes traveler/payment/provider state.
  // This hook only repairs the admin in-process commit path, where the host
  // navigates straight to /bookings/:id after /book.
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
  const party = asRecord(request.party)
  const billing = asRecord(party?.billing)
  const billingContact = asRecord(billing?.contact)
  const parameters = asRecord(request.parameters)
  const draft = asRecord(parameters?.draft)
  const configure = asRecord(draft?.configure)
  const dateRange = asRecord(configure?.dateRange)
  const pricing = result.pricing
  const currency = pricing?.currency ?? snapshot.pricing_currency ?? "EUR"
  const totalAmountCents = pricingTotalCents(pricing)
  const startDate = dateString(configure?.departureDate) ?? dateString(dateRange?.checkIn) ?? null
  const endDate = dateString(dateRange?.checkOut) ?? startDate
  const bookingStatus = bookingStatusForSourcedResult(result.status)
  const itemStatus = bookingStatus === "on_hold" ? "on_hold" : "confirmed"
  const title = sourcedBookingTitle(snapshot.frozen_payload, snapshot.entity_id)
  const bookingNumber = localBookingNumber("SRC")
  const contact = {
    firstName: stringValue(billingContact?.firstName),
    lastName: stringValue(billingContact?.lastName),
    email: stringValue(billingContact?.email),
    phone: stringValue(billingContact?.phone),
  }

  return {
    booking: {
      id: result.bookingId,
      bookingNumber,
      status: bookingStatus,
      personId: stringValue(party?.personId) ?? stringValue(billing?.personId) ?? null,
      organizationId:
        stringValue(party?.organizationId) ?? stringValue(billing?.organizationId) ?? null,
      sourceType: "api_partner" as const,
      externalBookingRef: result.orderRef,
      contactFirstName: contact.firstName ?? null,
      contactLastName: contact.lastName ?? null,
      contactEmail: contact.email ?? null,
      contactPhone: contact.phone ?? null,
      sellCurrency: currency,
      sellAmountCents: totalAmountCents,
      startDate,
      endDate,
      pax: totalPaxFromDraft(draft),
      internalNotes: `Sourced booking committed via ${snapshot.source_kind}. Snapshot: ${snapshot.id}`,
    },
    item: {
      id: newId("booking_items"),
      bookingId: result.bookingId,
      title,
      itemType: "unit" as const,
      status: itemStatus,
      serviceDate: startDate,
      quantity: 1,
      sellCurrency: currency,
      unitSellAmountCents: totalAmountCents,
      totalSellAmountCents: totalAmountCents,
      productId: snapshot.entity_module === "products" ? snapshot.entity_id : null,
      sourceSnapshotId: snapshot.id,
      sourceOfferId: snapshot.source_ref,
      productNameSnapshot: title,
      metadata: {
        entityModule: snapshot.entity_module,
        entityId: snapshot.entity_id,
        sourceKind: snapshot.source_kind,
        sourceConnectionId: snapshot.source_connection_id,
        upstreamRef: result.orderRef,
      },
    },
    activity: {
      bookingId: result.bookingId,
      actorId,
      activityType: "booking_created" as const,
      description: `Booking ${bookingNumber} created from sourced catalog order ${result.orderRef}`,
      metadata: {
        sourceKind: snapshot.source_kind,
        snapshotId: snapshot.id,
        orderRef: result.orderRef,
      },
    },
  }
}

async function prepareConnectPackageBookParameters({
  c,
  parameters,
  provenance,
  quote,
}: CatalogBookingPrepareBookParametersInput): Promise<Record<string, unknown>> {
  if (parameters.connectRoute !== "packages") return parameters
  if (stringValue(parameters.holdId)) return parameters
  if (provenance.sourceKind !== "voyant-connect" || !provenance.sourceConnectionId) {
    return parameters
  }

  const offer = readPackageOffer(quote?.upstream_payload)
  if (!offer) return parameters

  const config = resolveVoyantConnectEnv(c.env as Record<string, string | undefined>, {
    warn: (message) => console.warn(`[catalog-booking] ${message}`),
  })
  if (!config) return parameters

  const client = createVoyantConnectClient({
    apiKey: config.apiKey,
    operatorId: config.operatorId,
    baseUrl: config.baseUrl,
  })
  const hold = await client.packages.lock(provenance.sourceConnectionId, offer)
  return {
    ...parameters,
    holdId: hold.id,
  }
}

function readPackageOffer(value: unknown): PackageOffer | undefined {
  const payload = asRecord(value)
  const offer = asRecord(payload?.offer) ?? payload
  return isPackageOffer(offer) ? offer : undefined
}

function isPackageOffer(value: unknown): value is PackageOffer {
  const offer = asRecord(value)
  if (!offer) return false
  if (
    !stringValue(offer.id) ||
    !stringValue(offer.connectionId) ||
    !stringValue(offer.supplierId)
  ) {
    return false
  }
  if (!asRecord(offer.productRef) || !asRecord(offer.stay) || !Array.isArray(offer.flights)) {
    return false
  }
  if (!asRecord(offer.pricing) || !asRecord(offer.cancellationPolicy)) {
    return false
  }
  if (!stringValue(offer.expiresAt)) {
    return false
  }
  return true
}

function bookingStatusForSourcedResult(
  status: BookEntityResult["status"],
): "on_hold" | "confirmed" {
  return status === "held" ? "on_hold" : "confirmed"
}

function pricingTotalCents(pricing: BookEntityResult["pricing"]): number | null {
  if (!pricing) return null
  return Math.round(pricing.base_amount + pricing.taxes + pricing.fees + pricing.surcharges)
}

function totalPaxFromDraft(draft: Record<string, unknown> | undefined): number | null {
  const configure = asRecord(draft?.configure)
  const pax = asRecord(configure?.pax)
  if (!pax) return null
  const total = Object.values(pax).reduce<number>(
    (sum, value) => sum + (typeof value === "number" && Number.isFinite(value) ? value : 0),
    0,
  )
  return total > 0 ? total : null
}

function sourcedBookingTitle(frozenPayload: unknown, fallback: string): string {
  const payload = asRecord(frozenPayload)
  const content = asRecord(payload?.content)
  const product = asRecord(content?.product)
  const hotel = asRecord(content?.hotel)
  const cruise = asRecord(content?.cruise)
  return (
    stringValue(product?.name) ??
    stringValue(hotel?.name) ??
    stringValue(cruise?.name) ??
    stringValue(payload?.name) ??
    fallback
  )
}

function dateString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : null
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function localBookingNumber(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${suffix}`
}

/**
 * Read the owned `availability_slots` rows for a product (owned slots path).
 * Lives in the deployment because `@voyant-travel/operations` depends on
 * `@voyant-travel/catalog` — injecting this keeps the catalog package free of
 * a static operations import. Maps rows into the package's `SlotRow` shape.
 */
async function listAvailabilitySlots(
  db: AnyDrizzleDb,
  productId: string,
  todayIso: string,
  _scope: CatalogAvailabilitySlotsScope,
): Promise<SlotRow[]> {
  return (db as PostgresJsDatabase)
    .select({
      id: availabilitySlots.id,
      dateLocal: availabilitySlots.dateLocal,
      startsAt: availabilitySlots.startsAt,
      endsAt: availabilitySlots.endsAt,
      timezone: availabilitySlots.timezone,
      status: availabilitySlots.status,
      unlimited: availabilitySlots.unlimited,
      remainingPax: availabilitySlots.remainingPax,
      initialPax: availabilitySlots.initialPax,
      nights: availabilitySlots.nights,
      days: availabilitySlots.days,
    })
    .from(availabilitySlots)
    .where(
      and(
        eq(availabilitySlots.productId, productId),
        eq(availabilitySlots.status, "open"),
        gte(availabilitySlots.dateLocal, todayIso),
      ),
    )
    .orderBy(asc(availabilitySlots.startsAt))
    .limit(60)
}

/**
 * Build the full catalog booking-engine route-module options for this
 * deployment, including the three cross-package readers the package can't
 * import statically (would cycle through inventory/operations → catalog).
 */
function createOperatorCatalogBookingRouteModuleOptions(): CatalogBookingRouteModuleOptions {
  return {
    booking: createOperatorCatalogBookingRoutesOptions(),
    resolveRegistry: getBookingEngineRegistryFromContext,
    getProductContent: (db, productId, scope, ctx) => getProductContent(db, productId, scope, ctx),
    listAvailabilitySlots,
    getOwnedProductById: async (db, productId) => {
      const product = await productsService.getProductById(db as PostgresJsDatabase, productId)
      if (!product) return null
      return { name: product.name, description: product.description }
    },
  }
}

/**
 * Mount the full catalog booking-engine surface (lifecycle + orders + slots +
 * catalog-snapshot) onto an absolute-path Hono app, wired with this
 * deployment's options + cross-package readers.
 */
export function mountCatalogBookingRoutes(hono: CatalogBookingMountTarget): void {
  mountPackageCatalogBookingRoutes(hono, createOperatorCatalogBookingRouteModuleOptions())
}

function positiveMinutes(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null
}

async function resolveHoldTtlMs(
  db: AnyDrizzleDb,
  entityModule: string,
  entityId: string,
): Promise<number> {
  if (entityModule !== "products") {
    return DEFAULT_HOLD_TTL_MS
  }

  const [product] = await db
    .select({
      supplierId: products.supplierId,
      reservationTimeoutMinutes: products.reservationTimeoutMinutes,
    })
    .from(products)
    .where(eq(products.id, entityId))
    .limit(1)

  const productMinutes = positiveMinutes(product?.reservationTimeoutMinutes)
  if (productMinutes !== null) {
    return productMinutes * 60 * 1000
  }

  if (!product?.supplierId) {
    return DEFAULT_HOLD_TTL_MS
  }

  const [supplier] = await db
    .select({ reservationTimeoutMinutes: suppliers.reservationTimeoutMinutes })
    .from(suppliers)
    .where(eq(suppliers.id, product.supplierId))
    .limit(1)

  return (positiveMinutes(supplier?.reservationTimeoutMinutes) ?? 30) * 60 * 1000
}

export async function applyOperatorTaxToQuoteResult(
  db: AnyDrizzleDb,
  result: QuoteEntityResult,
  entityModule: string,
  entityId: string,
  sourceKind: string,
): Promise<QuoteEntityResult> {
  if (!result.available || !result.pricing) return result
  // When promotional offers were applied at quote time, quoteEntity
  // clears taxes + breakdown because the upstream values were computed
  // against the un-discounted base. Recompute taxes here even for owned
  // quotes so discounted customer-facing totals remain correct.
  const hasAppliedOffers = (result.pricing.appliedOffers?.length ?? 0) > 0
  if (sourceKind === OWNED_SOURCE_KIND && !hasAppliedOffers) return result
  if (result.pricing.taxes > 0 && !hasAppliedOffers) return result

  const pricing = result.pricing
  const taxableCents = pricing.base_amount
  const taxRate = await resolveBookingSellTaxRate(
    db as PostgresJsDatabase,
    {
      productId: entityModule === "products" ? entityId : null,
      facts: { hasAccommodation: false, accommodationCountries: [] },
    },
    {
      resolveBookingTaxSettings,
    },
  )
  const taxLine = computeBookingItemTaxLine(taxRate, taxableCents, pricing.currency)
  if (!taxLine) return result

  const inclusive = taxLine.includedInPrice
  const subtotal = inclusive ? Math.max(0, taxableCents - taxLine.amountCents) : taxableCents
  const total = inclusive ? taxableCents : taxableCents + taxLine.amountCents
  const adjustedPricing = {
    ...pricing,
    base_amount: subtotal,
    taxes: taxLine.amountCents,
    breakdown: {
      currency: pricing.currency,
      lines: [
        {
          kind: "base",
          label: "Base",
          quantity: 1,
          unitAmount: taxableCents,
          totalAmount: taxableCents,
          taxIncluded: inclusive,
        },
      ],
      taxes: [
        {
          code: taxLine.code ?? "tax",
          label: taxLine.name,
          rate: (taxLine.rateBasisPoints ?? 0) / 10_000,
          amount: taxLine.amountCents,
          base: subtotal,
          includedInPrice: inclusive,
          scope: taxLine.scope,
        },
      ],
      subtotal,
      taxTotal: taxLine.amountCents,
      total,
    },
  }

  await (db as PostgresJsDatabase)
    .update(catalogQuotesTable)
    .set({
      pricing_base_amount: String(adjustedPricing.base_amount),
      pricing_taxes: String(adjustedPricing.taxes),
      pricing_fees: String(adjustedPricing.fees),
      pricing_surcharges: String(adjustedPricing.surcharges),
      pricing_currency: adjustedPricing.currency,
      pricing_breakdown: adjustedPricing.breakdown,
    })
    .where(eq(catalogQuotesTable.id, result.quoteId))

  return { ...result, pricing: adjustedPricing }
}

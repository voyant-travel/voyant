import {
  type BookEntityResult,
  type BookingDraftV1,
  bookingDraftV1,
  type CatalogBookingRoutesOptions,
  catalogQuotesTable,
  OWNED_SOURCE_KIND,
  type QuoteEntityResult,
} from "@voyantjs/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { computeBookingItemTaxLine, resolveBookingSellTaxRate } from "@voyantjs/finance"
import { productComponentRowToTravelComponent, products, productsService } from "@voyantjs/products"
import { createCatalogPromotionEvaluator } from "@voyantjs/promotions/service-catalog-evaluator"
import { suppliers } from "@voyantjs/suppliers"
import {
  projectIndependentCatalogComponents,
  travelComposerService,
} from "@voyantjs/travel-composer"
import { tripComponents } from "@voyantjs/travel-composer/schema"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import {
  getBookingEngineRegistryFromContext,
  getOwnedBookingHandlerRegistryFromContext,
} from "./lib/booking-engine-runtime"
import { resolveBookingTaxSettings } from "./settings"

const DEFAULT_HOLD_TTL_MS = 30 * 60 * 1000
interface TripComponentLookupDb {
  select(fields: unknown): {
    from(table: unknown): {
      where(condition: unknown): {
        limit(limit: number): Promise<Array<{ id: string; envelopeId: string }>>
      }
    }
  }
}

export function getCatalogBookingDb(c: Context): AnyDrizzleDb {
  return (c.var as { db: AnyDrizzleDb }).db
}

export function createOperatorCatalogBookingRoutesOptions(): CatalogBookingRoutesOptions {
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
    transformQuoteResult: ({ db, result, request, provenance }) =>
      applyOperatorTaxToQuoteResult(
        db,
        result,
        request.entityModule,
        request.entityId,
        provenance.sourceKind,
      ),
    onDraftConsumedError: ({ error }) => {
      console.warn("[catalog-booking] markDraftConsumed failed:", error)
    },
    transformBookResult: ({ db, result }) => withIndependentComponentTripReference(db, result),
    onCommitted: async (event) => {
      try {
        await materializeIndependentComponentTrip(event)
      } catch (error) {
        console.warn("[catalog-booking] independent component trip materialization failed:", error)
      }
    },
  }
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

export async function materializeIndependentComponentTrip({
  db,
  request,
  result,
}: Parameters<NonNullable<CatalogBookingRoutesOptions["onCommitted"]>>[0]): Promise<void> {
  const bookingDraft = parseBookingDraft(request.parameters?.draft)
  if (!bookingDraft || bookingDraft.entity.module !== "products") return

  const selections = bookingDraft.configure.componentSelections ?? []
  if (selections.length === 0) return

  const pgDb = db as PostgresJsDatabase
  const bookingId = committedBookingId(result)
  const existing = await pgDb
    .select({ id: tripComponents.id })
    .from(tripComponents)
    .where(eq(tripComponents.bookingId, bookingId))
    .limit(1)
  if (existing[0]) return

  const componentRows = await productsService.listComponents(pgDb, {
    productId: bookingDraft.entity.id,
    commitmentBoundary: "independent_component",
    limit: 100,
    offset: 0,
  })
  if (componentRows.data.length === 0) return

  const independentComponents = projectIndependentCatalogComponents({
    components: componentRows.data.map(productComponentRowToTravelComponent),
    selections,
    baseBookingDraft: bookingDraft,
    startSequence: 1,
  })
  if (independentComponents.length === 0) return

  const trip = await travelComposerService.createTrip(db, {
    title: `Package booking ${result.orderRef}`,
    travelerParty: travelerPartyFromDraft(bookingDraft, request.party),
    constraints: {
      source: "catalog_booking_independent_components",
      catalogBookingId: result.bookingId,
      committedBookingId: bookingId,
      orderRef: result.orderRef,
    },
  })

  const coreComponent = await travelComposerService.addComponent(db, {
    envelopeId: trip.envelope.id,
    sequence: 0,
    kind: "catalog_booking",
    description: "Core product booking",
    catalogRef: {
      entityModule: bookingDraft.entity.module,
      entityId: bookingDraft.entity.id,
      sourceKind: bookingDraft.entity.sourceKind,
      ...(bookingDraft.entity.sourceConnectionId
        ? { sourceConnectionId: bookingDraft.entity.sourceConnectionId }
        : {}),
      ...(bookingDraft.entity.sourceRef ? { sourceRef: bookingDraft.entity.sourceRef } : {}),
    },
    metadata: {
      bookingDraftV1: bookingDraft,
      catalogBooking: {
        bookingId: result.bookingId,
        committedBookingId: bookingId,
        orderRef: result.orderRef,
      },
    },
  })

  await travelComposerService.updateComponent(db, coreComponent.id, { status: "priced" })
  await travelComposerService.updateComponentRefs(db, coreComponent.id, {
    committedRef: {
      bookingId,
      orderId: result.orderRef,
      providerRef: result.orderRef,
      supplierRef: result.orderRef,
    },
  })
  await travelComposerService.updateComponent(db, coreComponent.id, {
    status: result.status === "held" ? "held" : "booked",
  })

  for (const component of independentComponents) {
    await travelComposerService.addComponent(db, {
      ...component,
      envelopeId: trip.envelope.id,
    })
  }
}

export async function withIndependentComponentTripReference(
  db: AnyDrizzleDb | TripComponentLookupDb,
  result: BookEntityResult,
): Promise<BookEntityResult> {
  const bookingId = committedBookingId(result)
  const [component] = await (db as TripComponentLookupDb)
    .select({
      id: tripComponents.id,
      envelopeId: tripComponents.envelopeId,
    })
    .from(tripComponents)
    .where(eq(tripComponents.bookingId, bookingId))
    .limit(1)

  if (!component) return result

  return {
    ...result,
    upstreamPayload: {
      ...(result.upstreamPayload ?? {}),
      tripEnvelopeId: component.envelopeId,
      tripComponentId: component.id,
    },
  }
}

function parseBookingDraft(value: unknown): BookingDraftV1 | null {
  const parsed = bookingDraftV1.safeParse(value)
  return parsed.success ? parsed.data : null
}

function travelerPartyFromDraft(
  draft: BookingDraftV1,
  party: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const partyRecord = asRecord(party)
  const travelerParty = asRecord(partyRecord?.travelerParty)
  if (travelerParty) return travelerParty

  return {
    billing: {
      contact: draft.billing.contact,
      ...(draft.billing.company ? { organization: draft.billing.company } : {}),
    },
    travelers: draft.travelers.map((traveler) => ({
      firstName: traveler.firstName,
      lastName: traveler.lastName,
      email: traveler.email,
      phone: traveler.phone,
    })),
  }
}

function committedBookingId(result: {
  bookingId: string
  upstreamPayload?: Record<string, unknown>
}): string {
  const bridgeBookingId = result.upstreamPayload?.bridgeBookingId
  return typeof bridgeBookingId === "string" && bridgeBookingId.length > 0
    ? bridgeBookingId
    : result.bookingId
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

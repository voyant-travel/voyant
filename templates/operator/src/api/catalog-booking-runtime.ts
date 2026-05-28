import {
  type CatalogBookingRoutesOptions,
  catalogQuotesTable,
  OWNED_SOURCE_KIND,
  type QuoteEntityResult,
} from "@voyantjs/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { computeBookingItemTaxLine, resolveBookingSellTaxRate } from "@voyantjs/finance"
import { products } from "@voyantjs/products"
import { createCatalogPromotionEvaluator } from "@voyantjs/promotions/service-catalog-evaluator"
import { suppliers } from "@voyantjs/suppliers"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import {
  getBookingEngineRegistryFromContext,
  getOwnedBookingHandlerRegistryFromContext,
} from "./lib/booking-engine-runtime"
import { resolveBookingTaxSettings } from "./settings"

const DEFAULT_HOLD_TTL_MS = 30 * 60 * 1000

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

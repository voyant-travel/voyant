/**
 * Storefront resolvers — populate the previously-empty
 * `/v1/public/products/:productId/offers` and `/v1/public/offers/:slug`
 * endpoints in `@voyantjs/storefront` with real data.
 *
 * Wire via:
 *
 *   const storefrontModule = createStorefrontHonoModule({
 *     offers: createPromotionsStorefrontResolvers(),
 *   })
 *
 * Per docs/architecture/promotions-architecture.md §8.
 *
 * V1 limitations:
 *   - Storefront calls don't carry an audience / market in the request
 *     context, so the resolver only filters by `products` + `global`
 *     scopes (the catalog plane handles audience-scoped projection).
 *     `markets` and `audiences` scoped offers don't appear in this
 *     listing endpoint.
 *   - Locale-aware offer names: the schema doesn't store translations
 *     yet (single-locale offer names per §12.1); `locale` is accepted
 *     but ignored. A `promotional_offer_translations` table mirrors
 *     `destinations_translations` if/when needed.
 *   - `applicableDepartureIds`: always empty per §12.7 — departure-
 *     scoped offers aren't modelled in v1.
 *   - Only auto-applied offers (no code) appear in `listApplicableOffers`;
 *     code-gated offers are still queryable via `getOfferBySlug`.
 */

import type { AnyDrizzleDb } from "@voyantjs/db"
import type {
  StorefrontOfferResolvers,
  StorefrontPromotionalOffer,
  StorefrontRequestContext,
} from "@voyantjs/storefront"
import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm"

import { type PromotionalOffer, promotionalOfferProducts, promotionalOffers } from "./schema.js"
import type { PromotionalOfferScope } from "./validation.js"

export function createPromotionsStorefrontResolvers(): StorefrontOfferResolvers {
  return {
    async listApplicableOffers(input) {
      const db = resolveDb(input)
      if (!db) return []

      const now = new Date()
      // Active + currently-valid + auto-applied (no code) offers.
      const baseRows = await db
        .select()
        .from(promotionalOffers)
        .where(
          and(
            eq(promotionalOffers.active, true),
            isNull(promotionalOffers.code),
            or(isNull(promotionalOffers.validFrom), lte(promotionalOffers.validFrom, now)),
            or(isNull(promotionalOffers.validUntil), gte(promotionalOffers.validUntil, now)),
          ),
        )

      if (baseRows.length === 0) return []

      // Restrict to offers that match the product: either `global` scope
      // (always matches) OR a product-shaped scope whose materialized
      // link table contains this product.
      const productLinkRows = await db
        .select({ offerId: promotionalOfferProducts.offerId })
        .from(promotionalOfferProducts)
        .where(
          and(
            eq(promotionalOfferProducts.productId, input.productId),
            inArray(
              promotionalOfferProducts.offerId,
              baseRows.map((r) => r.id),
            ),
          ),
        )
      const offersMatchingProduct = new Set(productLinkRows.map((r) => r.offerId))

      const productLinkLookups = await loadApplicableProductIds(
        db,
        baseRows.map((r) => r.id),
      )

      const out: StorefrontPromotionalOffer[] = []
      for (const offer of baseRows) {
        if (!matchesProduct(offer.scope, offersMatchingProduct.has(offer.id))) continue
        out.push(toStorefrontDto(offer, productLinkLookups.get(offer.id) ?? []))
      }
      return out
    },

    async getOfferBySlug(input) {
      const db = resolveDb(input)
      if (!db) return null

      const rows = await db
        .select()
        .from(promotionalOffers)
        .where(and(eq(promotionalOffers.slug, input.slug), eq(promotionalOffers.active, true)))
        .limit(1)
      const offer = rows[0]
      if (!offer) return null

      const links = await loadApplicableProductIds(db, [offer.id])
      return toStorefrontDto(offer, links.get(offer.id) ?? [])
    },
  }
}

function resolveDb(input: StorefrontRequestContext): AnyDrizzleDb | undefined {
  return input.db ?? undefined
}

function matchesProduct(scope: PromotionalOfferScope, inLinkTable: boolean): boolean {
  switch (scope.kind) {
    case "global":
      return true
    case "products":
    case "categories":
    case "destinations":
      return inLinkTable
    // markets / audiences scopes don't render via this endpoint in v1
    // (no audience / market in the request context). They're still
    // honored by the catalog projection (PR3) when products are indexed.
    case "markets":
    case "audiences":
      return false
  }
}

async function loadApplicableProductIds(
  db: AnyDrizzleDb,
  offerIds: string[],
): Promise<Map<string, string[]>> {
  if (offerIds.length === 0) return new Map()
  const rows = await db
    .select({
      offerId: promotionalOfferProducts.offerId,
      productId: promotionalOfferProducts.productId,
    })
    .from(promotionalOfferProducts)
    .where(inArray(promotionalOfferProducts.offerId, offerIds))
  const out = new Map<string, string[]>()
  for (const row of rows) {
    const list = out.get(row.offerId) ?? []
    list.push(row.productId)
    out.set(row.offerId, list)
  }
  return out
}

function toStorefrontDto(
  offer: PromotionalOffer,
  applicableProductIds: string[],
): StorefrontPromotionalOffer {
  return {
    id: offer.id,
    name: offer.name,
    slug: offer.slug,
    description: offer.description,
    discountType: offer.discountType,
    // The DTO carries `discountValue` as a string for both flavors.
    // Percentage offers store the percent ("20"); fixed_amount offers
    // store the cents amount as a string ("500" for $5.00).
    discountValue:
      offer.discountType === "percentage"
        ? (offer.discountPercent ?? "0")
        : String(offer.discountAmountCents ?? 0),
    currency: offer.currency,
    applicableProductIds,
    // V1: departure-scoped offers aren't modelled (per §12.7).
    applicableDepartureIds: [],
    validFrom: offer.validFrom?.toISOString() ?? null,
    validTo: offer.validUntil?.toISOString() ?? null,
    minTravelers:
      typeof offer.conditions === "object" && offer.conditions != null
        ? (offer.conditions.minPax ?? null)
        : null,
    // V1: no merchandising images on offers (per §2 non-goals).
    imageMobileUrl: null,
    imageDesktopUrl: null,
    stackable: offer.stackable,
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
  }
}

export const __test__ = { matchesProduct, toStorefrontDto }

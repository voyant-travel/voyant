import type { CatalogInventoryRuntimeExtension } from "@voyant-travel/catalog/runtime-contracts"
import { createProductQuoteShapeEnricher } from "@voyant-travel/catalog/runtime-support"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { registerProductBookingHandler } from "./booking-engine/product-runtime.js"
import { productCatalogPolicy } from "./catalog-policy.js"
import { productDeparturesCatalogPolicy } from "./catalog-policy-departures.js"
import { productDestinationsCatalogPolicy } from "./catalog-policy-destinations.js"
import { productPricingCatalogPolicy } from "./catalog-policy-pricing.js"
import { productPromotionsCatalogPolicy } from "./catalog-policy-promotions.js"
import { productTaxonomyCatalogPolicy } from "./catalog-policy-taxonomy.js"
import { buildProductDraftShape } from "./draft-shape.js"
import { extrasCatalogPolicy } from "./extras.js"
import { products } from "./schema.js"
import { productsService } from "./service.js"
import {
  buildProductSnapshotInput,
  createProductDocumentBuilder,
  createProductStorefrontCardProjectionExtension,
} from "./service-catalog-plane.js"
import { createProductDestinationsProjectionExtension } from "./service-catalog-plane-destinations.js"
import { createProductTaxonomyProjectionExtension } from "./service-catalog-plane-taxonomy.js"
import { getProductContent } from "./service-content.js"
import { listProductsReferencingAccommodationProperty } from "./service-presentation-references.js"

export const enrichProductQuoteShape = createProductQuoteShapeEnricher({
  resolveContent: ({
    db,
    entityId,
    locales,
    audience,
    market,
    currency,
    registry,
    adapterContext,
  }) =>
    getProductContent(
      db as Parameters<typeof getProductContent>[0],
      entityId,
      { preferredLocales: locales, audience, market, currency },
      { registry, buildAdapterContext: () => adapterContext },
    ),
  buildShape: (content, options) =>
    buildProductDraftShape(content as Parameters<typeof buildProductDraftShape>[0], options),
})

export const catalogInventoryRuntimeExtension = {
  productFieldPolicy: [
    ...productCatalogPolicy,
    ...productDestinationsCatalogPolicy,
    ...productTaxonomyCatalogPolicy,
    ...productDeparturesCatalogPolicy,
    ...productPricingCatalogPolicy,
    ...productPromotionsCatalogPolicy,
  ],
  extrasFieldPolicy: extrasCatalogPolicy,
  createDocumentBuilder: ({
    db,
    sellerOperatorId,
    registry,
    extensions,
    isPublicAudienceListable,
  }) =>
    createProductDocumentBuilder(db, {
      sellerOperatorId,
      registry,
      extensions,
      isPublicAudienceListable,
    }),
  createStorefrontCardProjectionExtension: () => createProductStorefrontCardProjectionExtension(),
  createDestinationsProjectionExtension: () => createProductDestinationsProjectionExtension(),
  createTaxonomyProjectionExtension: () => createProductTaxonomyProjectionExtension(),
  listProductsReferencingAccommodationProperty,
  registerOwnedBookingHandler: registerProductBookingHandler,
  getProductContent: (db, productId, scope, context) =>
    getProductContent(db, productId, scope, context),
  async getOwnedProductById(db, productId) {
    const product = await productsService.getProductById(db as PostgresJsDatabase, productId)
    return product ? { name: product.name, description: product.description } : null
  },
  async loadProductReservationPolicy(db, productId) {
    const [product] = await db
      .select({
        supplierId: products.supplierId,
        reservationTimeoutMinutes: products.reservationTimeoutMinutes,
      })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)
    return product ?? null
  },
  enrichProductQuoteShape,
  buildSnapshotInput: (db, productId, options) => buildProductSnapshotInput(db, productId, options),
} satisfies CatalogInventoryRuntimeExtension

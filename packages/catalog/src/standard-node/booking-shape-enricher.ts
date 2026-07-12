import { buildProductDraftShape } from "@voyant-travel/inventory/draft-shape"
import { getProductContent } from "@voyant-travel/inventory/service-content"
import { createProductQuoteShapeEnricher } from "../operator-runtime.js"

export const enrichProductQuoteShape = createProductQuoteShapeEnricher({
  resolveContent: ({ db, entityId, locales, market, currency, registry, adapterContext }) =>
    getProductContent(
      db as Parameters<typeof getProductContent>[0],
      entityId,
      { preferredLocales: locales, market, currency },
      { registry, buildAdapterContext: () => adapterContext },
    ),
  buildShape: (content, options) =>
    buildProductDraftShape(content as Parameters<typeof buildProductDraftShape>[0], options),
})

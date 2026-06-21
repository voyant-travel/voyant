import { getProductAggregates } from "./service-aggregates.js"
import { configurationProductsService } from "./service-configuration.js"
import { coreProductsService } from "./service-core.js"
import { deliveryFormatProductsService } from "./service-delivery-formats.js"
import { destinationProductsService } from "./service-destinations.js"
import { itineraryProductsService } from "./service-itinerary.js"
import { itineraryHistoryProductsService } from "./service-itinerary-history.js"
import { itineraryTranslationProductsService } from "./service-itinerary-translations.js"
import { mediaProductsService } from "./service-media.js"
import { merchandisingProductsService } from "./service-merchandising.js"
import { optionTranslationProductsService } from "./service-option-translations.js"
import { optionProductsService } from "./service-options.js"
import { productDestinationProductsService } from "./service-product-destinations.js"
import { taxonomyProductsService } from "./service-taxonomy.js"

export const productsService = {
  getProductAggregates,
  ...coreProductsService,
  ...configurationProductsService,
  ...deliveryFormatProductsService,
  ...merchandisingProductsService,
  ...destinationProductsService,
  ...productDestinationProductsService,
  ...optionProductsService,
  ...optionTranslationProductsService,
  ...itineraryProductsService,
  ...itineraryTranslationProductsService,
  ...itineraryHistoryProductsService,
  ...taxonomyProductsService,
  ...mediaProductsService,
}

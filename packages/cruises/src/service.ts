import { cruiseCoreService } from "./service-core.js"
import { cruiseEnrichmentService } from "./service-enrichment.js"
import { cruisePriceRowsService } from "./service-prices.js"
import { cruiseSailingsService } from "./service-sailings.js"
import { cruiseShipService } from "./service-ships.js"

export type { EffectiveItineraryDay } from "./service-itinerary.js"
export type { CruiseMutationRuntime } from "./service-shared.js"

export const cruisesService = {
  ...cruiseCoreService,
  ...cruiseSailingsService,
  ...cruiseShipService,
  ...cruisePriceRowsService,
  ...cruiseEnrichmentService,
}

import type { CatalogAccommodationsRuntimeExtension } from "@voyant-travel/catalog/runtime-contracts"

import { registerAccommodationBookingHandler } from "./booking-engine/runtime.js"
import { accommodationCatalogPolicy } from "./catalog-policy.js"

export const catalogAccommodationsRuntimeExtension = {
  fieldPolicy: accommodationCatalogPolicy,
  registerOwnedBookingHandler: registerAccommodationBookingHandler,
} satisfies CatalogAccommodationsRuntimeExtension

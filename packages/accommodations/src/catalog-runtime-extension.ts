import type {
  CatalogAccommodationsRuntimeExtension,
} from "@voyant-travel/catalog/runtime-contracts"

import { registerAccommodationBookingHandler } from "./booking-engine/runtime.js"
import { accommodationCatalogPolicy } from "./catalog-policy.js"
import {
  accommodationPropertyCatalogPolicy,
  accommodationPropertyReferenceCatalogPolicy,
} from "./catalog-policy-properties.js"
import { createRoomTypeDocumentBuilder } from "./service-catalog-plane.js"
import {
  createAccommodationPropertyDocumentBuilder,
  listAccommodationOffersReferencingProperty,
} from "./service-presentation-subjects.js"

export const catalogAccommodationsRuntimeExtension = {
  fieldPolicy: [...accommodationCatalogPolicy, ...accommodationPropertyReferenceCatalogPolicy],
  propertyFieldPolicy: accommodationPropertyCatalogPolicy,
  createDocumentBuilder: ({ db, sellerOperatorId }) =>
    createRoomTypeDocumentBuilder(db, { sellerOperatorId }),
  listAccommodationOffersReferencingProperty,
  createPropertyDocumentBuilder: createAccommodationPropertyDocumentBuilder,
  registerOwnedBookingHandler: registerAccommodationBookingHandler,
} satisfies CatalogAccommodationsRuntimeExtension

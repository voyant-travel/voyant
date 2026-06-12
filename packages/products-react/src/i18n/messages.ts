export type {
  ProductBookingMode,
  ProductCapacityMode,
  ProductStatus,
  ProductVisibility,
} from "./message-shared.js"

import type { ProductsUiCatalogMessages } from "./messages-catalog.js"
import type { ProductsUiCoreMessages } from "./messages-core.js"
import type { ProductsUiOperationsMessages } from "./messages-operations.js"

export type ProductsUiMessages = ProductsUiCoreMessages &
  ProductsUiCatalogMessages &
  ProductsUiOperationsMessages

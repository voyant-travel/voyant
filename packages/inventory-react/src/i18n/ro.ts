import type { ProductsUiMessages } from "./messages.js"
import { productsUiCatalogRo } from "./ro-catalog.js"
import { productsUiCoreRo } from "./ro-core.js"
import { productsUiOperationsRo } from "./ro-operations.js"

export const productsUiRo = {
  ...productsUiCoreRo,
  ...productsUiCatalogRo,
  ...productsUiOperationsRo,
} satisfies ProductsUiMessages

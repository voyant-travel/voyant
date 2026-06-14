import { productsUiCatalogEn } from "./en-catalog.js"
import { productsUiCoreEn } from "./en-core.js"
import { productsUiOperationsEn } from "./en-operations.js"
import type { ProductsUiMessages } from "./messages.js"

export const productsUiEn = {
  ...productsUiCoreEn,
  ...productsUiCatalogEn,
  ...productsUiOperationsEn,
} satisfies ProductsUiMessages

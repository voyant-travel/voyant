import type { LocaleMessageSchema } from "../runtime.js"
import { operatorAdminProductsMessagesEnCore } from "./products-operator/en-core.js"
import { operatorAdminProductsMessagesEnOperations } from "./products-operator/en-operations.js"
import { operatorAdminProductsMessagesEnTaxonomy } from "./products-operator/en-taxonomy.js"
import { operatorAdminProductsMessagesRoCore } from "./products-operator/ro-core.js"
import { operatorAdminProductsMessagesRoOperations } from "./products-operator/ro-operations.js"
import { operatorAdminProductsMessagesRoTaxonomy } from "./products-operator/ro-taxonomy.js"

export const operatorAdminProductsMessages = {
  en: {
    products: {
      taxonomy: operatorAdminProductsMessagesEnTaxonomy,
      core: operatorAdminProductsMessagesEnCore,
      operations: operatorAdminProductsMessagesEnOperations,
    },
  },
  ro: {
    products: {
      taxonomy: operatorAdminProductsMessagesRoTaxonomy,
      core: operatorAdminProductsMessagesRoCore,
      operations: operatorAdminProductsMessagesRoOperations,
    },
  },
}

export type OperatorAdminProductsMessages = LocaleMessageSchema<
  (typeof operatorAdminProductsMessages)["en"]
>

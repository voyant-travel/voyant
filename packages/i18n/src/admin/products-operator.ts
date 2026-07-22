import type { LocaleMessageSchema } from "../runtime.js"
import { operatorAdminProductsMessagesEnCore } from "./products-operator/en-core.js"
import { operatorAdminProductsMessagesEnEditorial } from "./products-operator/en-editorial.js"
import { operatorAdminProductsMessagesEnOperations } from "./products-operator/en-operations.js"
import { operatorAdminProductsMessagesEnTaxonomy } from "./products-operator/en-taxonomy.js"
import { operatorAdminProductsMessagesRoCore } from "./products-operator/ro-core.js"
import { operatorAdminProductsMessagesRoEditorial } from "./products-operator/ro-editorial.js"
import { operatorAdminProductsMessagesRoOperations } from "./products-operator/ro-operations.js"
import { operatorAdminProductsMessagesRoTaxonomy } from "./products-operator/ro-taxonomy.js"

export const operatorAdminProductsMessages = {
  en: {
    products: {
      taxonomy: operatorAdminProductsMessagesEnTaxonomy,
      core: operatorAdminProductsMessagesEnCore,
      editorial: operatorAdminProductsMessagesEnEditorial,
      operations: operatorAdminProductsMessagesEnOperations,
    },
  },
  ro: {
    products: {
      taxonomy: operatorAdminProductsMessagesRoTaxonomy,
      core: operatorAdminProductsMessagesRoCore,
      editorial: operatorAdminProductsMessagesRoEditorial,
      operations: operatorAdminProductsMessagesRoOperations,
    },
  },
}

export type OperatorAdminProductsMessages = LocaleMessageSchema<
  (typeof operatorAdminProductsMessages)["en"]
>

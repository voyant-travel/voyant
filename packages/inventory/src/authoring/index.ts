import type { Module } from "@voyant-travel/core"

export const inventoryAuthoringModule: Module = {
  name: "inventory-authoring",
}

export {
  type BuildProductGraphOptions,
  type BuildProductGraphResult,
  buildProductGraph,
} from "./builder.js"
export {
  type ClonedOption,
  type CloneProductOptions,
  type CloneProductOutcome,
  cloneProduct,
} from "./clone.js"
export { type AuthoringIssue, AuthoringValidationError } from "./errors.js"
export {
  catalogAuthoringExtension,
  catalogAuthoringRoutes,
  inventoryAuthoringExtension,
  inventoryAuthoringRoutes,
} from "./extension.js"
export type { NewProductAuthoringRequest, ProductAuthoringRequest } from "./schema.js"
export { productAuthoringRequests } from "./schema.js"
export {
  type AuthoringRunOptions,
  type ComposeProductOutcome,
  composeProduct,
  composeProductInTransaction,
} from "./service.js"
export { type ProductGraphSpec, productGraphSpecSchema } from "./spec.js"
export { validateProductGraph } from "./validate.js"

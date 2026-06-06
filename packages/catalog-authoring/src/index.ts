import type { Module } from "@voyantjs/core"

export const catalogAuthoringModule: Module = {
  name: "catalog-authoring",
}

export {
  type BuildProductGraphOptions,
  type BuildProductGraphResult,
  buildProductGraph,
} from "./builder.js"
export { type AuthoringIssue, AuthoringValidationError } from "./errors.js"
export { catalogAuthoringExtension, catalogAuthoringRoutes } from "./extension.js"
export type { NewProductAuthoringRequest, ProductAuthoringRequest } from "./schema.js"
export { productAuthoringRequests } from "./schema.js"
export { serializeProductGraph } from "./serialize.js"
export { type ProductGraphSpec, productGraphSpecSchema } from "./spec.js"

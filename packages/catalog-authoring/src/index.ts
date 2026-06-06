import type { Module } from "@voyantjs/core"

export const catalogAuthoringModule: Module = {
  name: "catalog-authoring",
}

export { catalogAuthoringExtension, catalogAuthoringRoutes } from "./extension.js"
export type { NewProductAuthoringRequest, ProductAuthoringRequest } from "./schema.js"
export { productAuthoringRequests } from "./schema.js"
export {
  type ProductGraphSpec,
  productGraphSpecSchema,
} from "./spec.js"

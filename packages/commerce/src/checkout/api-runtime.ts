import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"

import { createCatalogCheckoutApiExtension } from "./routes.js"
import { catalogCheckoutApiRuntimePort } from "./runtime-ports.js"

export const createCatalogCheckoutGraphExtension = defineGraphRuntimeFactory(async ({ getPort }) =>
  createCatalogCheckoutApiExtension(await getPort(catalogCheckoutApiRuntimePort)),
)

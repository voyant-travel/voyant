import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"

import { createCatalogCheckoutHonoExtension } from "./routes.js"
import { catalogCheckoutApiRuntimePort } from "./runtime-ports.js"

export const createCatalogCheckoutGraphExtension = defineGraphRuntimeFactory(async ({ getPort }) =>
  createCatalogCheckoutHonoExtension(await getPort(catalogCheckoutApiRuntimePort)),
)

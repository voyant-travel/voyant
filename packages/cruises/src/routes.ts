import { OpenAPIHono } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"

import { registerCruiseCoreRoutes } from "./routes-core.js"
import { registerCruiseDetailRoutes } from "./routes-detail.js"
import type { CruiseRoutesEnv as Env } from "./routes-env.js"
import { registerCruiseSailingAndPriceRoutes } from "./routes-sailings-prices.js"
import { registerCruiseSearchIndexRoutes } from "./routes-search-index.js"
import { registerCruiseShipRoutes } from "./routes-ships.js"
import { registerCruiseVoyageGroupRoutes } from "./routes-voyage-groups.js"

// `OpenAPIHono` (not a plain `Hono`) so every `.openapi()` route a register
// function adds contributes an operation to the shared OpenAPI registry the
// operator's build-time `mergeLazyOpenApiPaths` replay reads (voyant#2114).
// Register families not yet migrated keep calling plain `.get/.post(...)` on
// this instance — that works at runtime, the routes are just undocumented until
// their own backfill batch.
export const cruiseAdminRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })

registerCruiseCoreRoutes(cruiseAdminRoutes)
registerCruiseVoyageGroupRoutes(cruiseAdminRoutes)
registerCruiseSailingAndPriceRoutes(cruiseAdminRoutes)
registerCruiseShipRoutes(cruiseAdminRoutes)
registerCruiseSearchIndexRoutes(cruiseAdminRoutes)
registerCruiseDetailRoutes(cruiseAdminRoutes)

export type CruiseAdminRoutes = typeof cruiseAdminRoutes

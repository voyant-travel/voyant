import { Hono } from "hono"

import { registerCruiseCoreRoutes } from "./routes-core.js"
import { registerCruiseDetailRoutes } from "./routes-detail.js"
import type { CruiseRoutesEnv as Env } from "./routes-env.js"
import { registerCruiseSailingAndPriceRoutes } from "./routes-sailings-prices.js"
import { registerCruiseSearchIndexRoutes } from "./routes-search-index.js"
import { registerCruiseShipRoutes } from "./routes-ships.js"
import { registerCruiseVoyageGroupRoutes } from "./routes-voyage-groups.js"

export const cruiseAdminRoutes = new Hono<Env>()

registerCruiseCoreRoutes(cruiseAdminRoutes)
registerCruiseVoyageGroupRoutes(cruiseAdminRoutes)
registerCruiseSailingAndPriceRoutes(cruiseAdminRoutes)
registerCruiseShipRoutes(cruiseAdminRoutes)
registerCruiseSearchIndexRoutes(cruiseAdminRoutes)
registerCruiseDetailRoutes(cruiseAdminRoutes)

export type CruiseAdminRoutes = typeof cruiseAdminRoutes

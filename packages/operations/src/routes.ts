import { Hono } from "hono"

import { availabilityAdminRoutes, availabilityRoutes } from "./availability/routes.js"
import { groundRoutes } from "./ground/routes.js"
import { facilitiesRoutes } from "./places/routes.js"
import { resourcesRoutes } from "./resources/routes.js"

export const operationsRoutes = new Hono()
operationsRoutes.route("/availability", availabilityRoutes)
operationsRoutes.route("/", resourcesRoutes)
operationsRoutes.route("/", groundRoutes)
operationsRoutes.route("/", facilitiesRoutes)

export const operationsAdminRoutes = new Hono()
operationsAdminRoutes.route("/availability", availabilityAdminRoutes)

export type OperationsRoutes = typeof operationsRoutes
export type OperationsAdminRoutes = typeof operationsAdminRoutes

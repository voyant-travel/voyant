import { OpenAPIHono } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
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

// `OpenAPIHono` so the `.openapi()` operations registered by
// `availabilityAdminRoutes`, `groundRoutes`, and `facilitiesRoutes` propagate up
// to the composed framework app and surface under `/v1/admin/operations/*` in
// `framework-admin.json`. The same `groundRoutes` and `facilitiesRoutes`
// instances are mounted here (in addition to the legacy surface above) so their
// CRUD operations are documented on the admin surface.
export const operationsAdminRoutes = new OpenAPIHono({
  defaultHook: openApiValidationHook,
})
operationsAdminRoutes.route("/availability", availabilityAdminRoutes)
operationsAdminRoutes.route("/", groundRoutes)
operationsAdminRoutes.route("/", facilitiesRoutes)

export type OperationsRoutes = typeof operationsRoutes
export type OperationsAdminRoutes = typeof operationsAdminRoutes

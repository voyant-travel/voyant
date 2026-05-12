import { Hono } from "hono"

import { availabilityAllocationRoutes } from "./routes-allocation.js"
import { availabilityCoreRoutes } from "./routes-core.js"
import { availabilityPickupRoutes } from "./routes-pickups.js"
import type { Env } from "./routes-shared.js"

export const availabilityRoutes = new Hono<Env>()
availabilityRoutes.route("/", availabilityCoreRoutes)
availabilityRoutes.route("/", availabilityPickupRoutes)

export const availabilityAdminRoutes = new Hono<Env>()
availabilityAdminRoutes.route("/", availabilityAllocationRoutes)

export type AvailabilityRoutes = typeof availabilityRoutes
export type AvailabilityAdminRoutes = typeof availabilityAdminRoutes

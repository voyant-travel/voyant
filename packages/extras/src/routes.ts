import { bookingsExtrasRoutes } from "@voyantjs/bookings/extras"
import { inventoryExtrasRoutes } from "@voyantjs/inventory/extras"
import type { Hono as HonoApp } from "hono"
import { Hono } from "hono"

export const extrasRoutes: HonoApp = new Hono()
  .route("/", inventoryExtrasRoutes)
  .route("/", bookingsExtrasRoutes)

export type ExtrasRoutes = typeof extrasRoutes

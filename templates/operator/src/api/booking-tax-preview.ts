import { mountBookingTaxRoutes } from "@voyantjs/finance"
import type { Hono } from "hono"

import { resolveBookingTaxSettings, updateBookingTaxSettings } from "./settings"

export function mountBookingTaxPreviewRoutes(hono: Hono): void {
  mountBookingTaxRoutes(hono, { resolveBookingTaxSettings, updateBookingTaxSettings })
}

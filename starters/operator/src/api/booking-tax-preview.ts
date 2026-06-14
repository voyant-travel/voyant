import { mountBookingTaxRoutes } from "@voyant-travel/finance"
import type { Hono } from "hono"

import { resolveBookingTaxSettings, updateBookingTaxSettings } from "./settings"

export function mountBookingTaxPreviewRoutes(hono: Hono): void {
  mountBookingTaxRoutes(hono, { resolveBookingTaxSettings, updateBookingTaxSettings })
}

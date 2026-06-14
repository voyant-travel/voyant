import type { BookingsExtrasRoutes } from "@voyantjs/bookings/extras"
import type { BookingRequirementsRoutes } from "@voyantjs/bookings/requirements/routes"
import type { BookingRoutes } from "@voyantjs/bookings/routes"
import type { MarketsRoutes } from "@voyantjs/commerce/markets/routes"
import type { PricingRoutes } from "@voyantjs/commerce/pricing/routes"
import type { SellabilityRoutes } from "@voyantjs/commerce/sellability/routes"
import type { ExternalRefsRoutes } from "@voyantjs/distribution/external-refs/routes"
import type { DistributionRoutes } from "@voyantjs/distribution/routes"
import type { SupplierRoutes } from "@voyantjs/distribution/suppliers/routes"
import type { FinanceRoutes } from "@voyantjs/finance/routes"
import type { IdentityRoutes } from "@voyantjs/identity/routes"
import type { InventoryExtrasRoutes } from "@voyantjs/inventory/extras"
import type { ProductRoutes } from "@voyantjs/inventory/routes"
import type { AvailabilityRoutes } from "@voyantjs/operations/availability/routes"
import type { ResourcesRoutes } from "@voyantjs/operations/resources/routes"
import type { QuotesRoutes } from "@voyantjs/quotes/routes"
import type { RelationshipsRoutes } from "@voyantjs/relationships/routes"
import type { Hono } from "hono"

/**
 * Composed API type for Hono RPC.
 *
 * Since `createApp()` mounts modules dynamically in a loop,
 * the route types aren't captured via chaining. We define the
 * full type manually here so that `hono/client` can infer
 * end-to-end typed requests.
 */
type ApiRoutes = Hono & {
  "/v1/relationships": RelationshipsRoutes
  "/v1/quotes": QuotesRoutes
  "/v1/availability": AvailabilityRoutes
  "/v1/identity": IdentityRoutes
  "/v1/external-refs": ExternalRefsRoutes
  "/v1/booking-requirements": BookingRequirementsRoutes
  "/v1/extras": InventoryExtrasRoutes & BookingsExtrasRoutes
  "/v1/pricing": PricingRoutes
  "/v1/markets": MarketsRoutes
  "/v1/resources": ResourcesRoutes
  "/v1/sellability": SellabilityRoutes
  "/v1/distribution": DistributionRoutes
  "/v1/suppliers": SupplierRoutes
  "/v1/products": ProductRoutes
  "/v1/bookings": BookingRoutes
  "/v1/admin/finance": FinanceRoutes
}

export type AppType = ApiRoutes

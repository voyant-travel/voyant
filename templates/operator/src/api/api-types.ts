import type { AvailabilityRoutes } from "@voyantjs/availability/routes"
import type { BookingRequirementsRoutes } from "@voyantjs/booking-requirements/routes"
import type { BookingRoutes } from "@voyantjs/bookings/routes"
import type { CrmRoutes } from "@voyantjs/crm/routes"
import type { DistributionRoutes } from "@voyantjs/distribution/routes"
import type { ExternalRefsRoutes } from "@voyantjs/external-refs/routes"
import type { ExtrasRoutes } from "@voyantjs/extras/routes"
import type { FinanceRoutes } from "@voyantjs/finance/routes"
import type { IdentityRoutes } from "@voyantjs/identity/routes"
import type { MarketsRoutes } from "@voyantjs/markets/routes"
import type { PricingRoutes } from "@voyantjs/pricing/routes"
import type { ProductRoutes } from "@voyantjs/products/routes"
import type { ResourcesRoutes } from "@voyantjs/resources/routes"
import type { SellabilityRoutes } from "@voyantjs/sellability/routes"
import type { SupplierRoutes } from "@voyantjs/suppliers/routes"
import type { TransactionsRoutes } from "@voyantjs/transactions/routes"
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
  "/v1/crm": CrmRoutes
  "/v1/availability": AvailabilityRoutes
  "/v1/identity": IdentityRoutes
  "/v1/external-refs": ExternalRefsRoutes
  "/v1/booking-requirements": BookingRequirementsRoutes
  "/v1/extras": ExtrasRoutes
  "/v1/pricing": PricingRoutes
  "/v1/markets": MarketsRoutes
  "/v1/transactions": TransactionsRoutes
  "/v1/resources": ResourcesRoutes
  "/v1/sellability": SellabilityRoutes
  "/v1/distribution": DistributionRoutes
  "/v1/suppliers": SupplierRoutes
  "/v1/products": ProductRoutes
  "/v1/bookings": BookingRoutes
  "/v1/admin/finance": FinanceRoutes
}

export type AppType = ApiRoutes

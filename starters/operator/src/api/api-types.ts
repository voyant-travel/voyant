import type { BookingsExtrasRoutes } from "@voyant-travel/bookings/extras"
import type { BookingRequirementsRoutes } from "@voyant-travel/bookings/requirements/routes"
import type { BookingRoutes } from "@voyant-travel/bookings/routes"
import type { MarketsRoutes, PricingRoutes, SellabilityRoutes } from "@voyant-travel/commerce"
import type { ExternalRefsRoutes, SupplierRoutes } from "@voyant-travel/distribution"
import type { DistributionRoutes } from "@voyant-travel/distribution/routes"
import type { FinanceRoutes } from "@voyant-travel/finance/routes"
import type { IdentityRoutes } from "@voyant-travel/identity/routes"
import type { InventoryExtrasRoutes } from "@voyant-travel/inventory/extras"
import type { ProductRoutes } from "@voyant-travel/inventory/routes"
import type { OperationsAdminRoutes, OperationsRoutes } from "@voyant-travel/operations"
import type { QuotesRoutes } from "@voyant-travel/quotes/routes"
import type { RelationshipsRoutes } from "@voyant-travel/relationships/routes"
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
  "/v1/operations": OperationsRoutes
  "/v1/identity": IdentityRoutes
  "/v1/external-refs": ExternalRefsRoutes
  "/v1/booking-requirements": BookingRequirementsRoutes
  "/v1/extras": InventoryExtrasRoutes & BookingsExtrasRoutes
  "/v1/pricing": PricingRoutes
  "/v1/markets": MarketsRoutes
  "/v1/sellability": SellabilityRoutes
  "/v1/distribution": DistributionRoutes
  "/v1/suppliers": SupplierRoutes
  "/v1/products": ProductRoutes
  "/v1/bookings": BookingRoutes
  "/v1/admin/finance": FinanceRoutes
  "/v1/admin/operations": OperationsAdminRoutes
}

export type AppType = ApiRoutes

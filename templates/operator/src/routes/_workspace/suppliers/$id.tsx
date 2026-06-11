import { createFileRoute } from "@tanstack/react-router"
import {
  getSupplierNotesQueryOptions,
  getSupplierQueryOptions,
  getSupplierServiceRatesQueryOptions,
  getSupplierServicesQueryOptions,
} from "@voyantjs/suppliers-react"
import { SupplierDetailHost, SupplierDetailSkeleton } from "@voyantjs/suppliers-ui/admin"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// operatorFetcher so SSR loaders forward the request cookie.
const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

// Thin host for the package-delivered supplier detail page (packaged-admin
// RFC Phase 3). Page, navigation (semantic destinations, RFC §4.7), and the
// customer-payment-policy card (finance-ui's widget contribution on
// `supplier.details.payment-policy`) are package-owned; this file binds the
// route param onto the host and keeps the SSR prefetch app-side.
export const Route = createFileRoute("/_workspace/suppliers/$id")({
  loader: async ({ context, params }) => {
    const servicesData = await context.queryClient.ensureQueryData(
      getSupplierServicesQueryOptions(client, params.id),
    )

    await Promise.all([
      context.queryClient.ensureQueryData(getSupplierQueryOptions(client, params.id)),
      context.queryClient.ensureQueryData(getSupplierNotesQueryOptions(client, params.id)),
      ...servicesData.data.map((service) =>
        context.queryClient.ensureQueryData(
          getSupplierServiceRatesQueryOptions(client, params.id, service.id),
        ),
      ),
    ])
  },
  pendingComponent: SupplierDetailSkeleton,
  component: SupplierDetailRoute,
})

function SupplierDetailRoute() {
  const { id } = Route.useParams()

  return <SupplierDetailHost id={id} />
}

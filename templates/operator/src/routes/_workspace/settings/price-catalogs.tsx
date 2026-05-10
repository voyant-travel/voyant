import { createFileRoute } from "@tanstack/react-router"
import { defaultFetcher, getPriceCatalogsQueryOptions } from "@voyantjs/pricing-react"
import { PriceCatalogsPage } from "@voyantjs/pricing-ui"

import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/settings/price-catalogs")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getPriceCatalogsQueryOptions(
        { baseUrl: getApiUrl(), fetcher: defaultFetcher },
        { limit: 25, offset: 0 },
      ),
    ),
  component: PriceCatalogsRoute,
})

function PriceCatalogsRoute() {
  return (
    <div className="p-6">
      <PriceCatalogsPage />
    </div>
  )
}

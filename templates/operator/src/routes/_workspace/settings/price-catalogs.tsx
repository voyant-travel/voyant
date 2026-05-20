import { createFileRoute } from "@tanstack/react-router"
import { getPriceCatalogsQueryOptions } from "@voyantjs/pricing-react"
import { PriceCatalogsPage } from "@voyantjs/pricing-ui"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/settings/price-catalogs")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getPriceCatalogsQueryOptions(
        { baseUrl: getApiUrl(), fetcher: operatorFetcher },
        { limit: 25, offset: 0 },
      ),
    ),
  component: PriceCatalogsRoute,
})

function PriceCatalogsRoute() {
  return <PriceCatalogsPage />
}

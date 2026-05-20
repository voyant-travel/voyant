import { createFileRoute } from "@tanstack/react-router"
import { getPricingCategoriesQueryOptions } from "@voyantjs/pricing-react"
import { PricingCategoriesPage } from "@voyantjs/pricing-ui"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/settings/pricing-categories")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getPricingCategoriesQueryOptions(
        { baseUrl: getApiUrl(), fetcher: operatorFetcher },
        { limit: 25, active: undefined },
      ),
    ),
  component: PricingCategoriesRoute,
})

function PricingCategoriesRoute() {
  return <PricingCategoriesPage />
}

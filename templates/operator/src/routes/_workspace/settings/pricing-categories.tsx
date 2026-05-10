import { createFileRoute } from "@tanstack/react-router"
import { defaultFetcher, getPricingCategoriesQueryOptions } from "@voyantjs/pricing-react"
import { PricingCategoriesPage } from "@voyantjs/pricing-ui"

import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/settings/pricing-categories")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getPricingCategoriesQueryOptions(
        { baseUrl: getApiUrl(), fetcher: defaultFetcher },
        { limit: 25, active: undefined },
      ),
    ),
  component: PricingCategoriesRoute,
})

function PricingCategoriesRoute() {
  return (
    <div className="p-6">
      <PricingCategoriesPage />
    </div>
  )
}

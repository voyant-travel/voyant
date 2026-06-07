import { createFileRoute } from "@tanstack/react-router"
import { useAdminBreadcrumbs } from "@voyantjs/admin"
import { getDepartureProfitabilityQueryOptions } from "@voyantjs/finance-react"
import { ProfitabilityPage } from "@voyantjs/finance-ui"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/finance/profitability")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getDepartureProfitabilityQueryOptions({ baseUrl: getApiUrl(), fetcher: operatorFetcher }),
    ),
  component: ProfitabilityRoute,
})

function ProfitabilityRoute() {
  useAdminBreadcrumbs([{ label: "Profitability" }])
  return <ProfitabilityPage />
}

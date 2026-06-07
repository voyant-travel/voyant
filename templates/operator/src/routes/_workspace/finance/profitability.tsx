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

function exportUrl(kind: "departures" | "products", filters: { from?: string; to?: string }) {
  const params = new URLSearchParams()
  if (filters.from) params.set("from", filters.from)
  if (filters.to) params.set("to", filters.to)
  const qs = params.toString()
  return `${getApiUrl()}/v1/admin/finance/reports/profitability/${kind}/export${qs ? `?${qs}` : ""}`
}

function ProfitabilityRoute() {
  useAdminBreadcrumbs([{ label: "Profitability" }])
  return (
    <ProfitabilityPage
      onExportDepartures={(filters) =>
        window.open(exportUrl("departures", filters), "_blank", "noopener,noreferrer")
      }
      onExportProducts={(filters) =>
        window.open(exportUrl("products", filters), "_blank", "noopener,noreferrer")
      }
    />
  )
}

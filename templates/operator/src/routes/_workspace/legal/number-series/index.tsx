import { createFileRoute } from "@tanstack/react-router"
import { getLegalContractNumberSeriesQueryOptions } from "@voyantjs/legal-react"
import { NumberSeriesPage } from "@voyantjs/legal-ui"

import { NumberSeriesDialog } from "@/components/voyant/legal/number-series-dialog"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/legal/number-series/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getLegalContractNumberSeriesQueryOptions({ baseUrl: getApiUrl(), fetcher: operatorFetcher }),
    ),
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <NumberSeriesPage renderNumberSeriesDialog={(props) => <NumberSeriesDialog {...props} />} />
  )
}

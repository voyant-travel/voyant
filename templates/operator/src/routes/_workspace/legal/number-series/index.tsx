import { createFileRoute } from "@tanstack/react-router"
import { defaultFetcher, getLegalContractNumberSeriesQueryOptions } from "@voyantjs/legal-react"
import { NumberSeriesPage } from "@voyantjs/legal-ui"

import { NumberSeriesDialog } from "@/components/voyant/legal/number-series-dialog"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/legal/number-series/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getLegalContractNumberSeriesQueryOptions({ baseUrl: getApiUrl(), fetcher: defaultFetcher }),
    ),
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <NumberSeriesPage renderNumberSeriesDialog={(props) => <NumberSeriesDialog {...props} />} />
  )
}

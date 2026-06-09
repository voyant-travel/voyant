import { createFileRoute } from "@tanstack/react-router"
import {
  defaultFetcher,
  getQuoteQueryOptions,
  getQuoteVersionLinesQueryOptions,
  getQuoteVersionQueryOptions,
} from "@voyantjs/crm-react"
import { QuoteVersionDetailPage } from "@/components/voyant/crm/quote-version-detail-page"
import { getApiUrl } from "@/lib/env"

const routeClient = { baseUrl: getApiUrl(), fetcher: defaultFetcher }

export const Route = createFileRoute("/_workspace/quote-versions/$id")({
  loader: async ({ context, params }) => {
    const quoteVersion = await context.queryClient.ensureQueryData(
      getQuoteVersionQueryOptions(routeClient, params.id),
    )

    await Promise.all([
      context.queryClient.ensureQueryData(getQuoteVersionLinesQueryOptions(routeClient, params.id)),
      context.queryClient.ensureQueryData(getQuoteQueryOptions(routeClient, quoteVersion.quoteId)),
    ])
  },
  component: QuoteVersionDetailRoute,
})

function QuoteVersionDetailRoute() {
  const { id } = Route.useParams()
  return <QuoteVersionDetailPage id={id} />
}

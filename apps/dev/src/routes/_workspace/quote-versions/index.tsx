import { createFileRoute } from "@tanstack/react-router"
import { defaultFetcher, getQuoteVersionsQueryOptions } from "@voyantjs/crm-react"
import { QuoteVersionsPage } from "@/components/voyant/crm/quote-versions-page"
import { getApiUrl } from "@/lib/env"

const routeClient = { baseUrl: getApiUrl(), fetcher: defaultFetcher }

export const Route = createFileRoute("/_workspace/quote-versions/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(getQuoteVersionsQueryOptions(routeClient, { limit: 100 })),
  component: QuoteVersionsPage,
})

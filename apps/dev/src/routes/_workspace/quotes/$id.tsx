import { createFileRoute } from "@tanstack/react-router"
import {
  defaultFetcher,
  getActivitiesQueryOptions,
  getOrganizationQueryOptions,
  getPersonQueryOptions,
  getPipelineQueryOptions,
  getQuoteQueryOptions,
  getQuoteVersionsQueryOptions,
  getStagesQueryOptions,
  useQuote,
} from "@voyantjs/crm-react"
import { QuoteDetailPage } from "@/components/voyant/crm/quote-detail-page"
import { getApiUrl } from "@/lib/env"

const routeClient = { baseUrl: getApiUrl(), fetcher: defaultFetcher }

export const Route = createFileRoute("/_workspace/quotes/$id")({
  loader: async ({ context, params }) => {
    const quote = await context.queryClient.ensureQueryData(
      getQuoteQueryOptions(routeClient, params.id),
    )

    await Promise.all([
      quote.personId
        ? context.queryClient.ensureQueryData(getPersonQueryOptions(routeClient, quote.personId))
        : Promise.resolve(),
      quote.organizationId
        ? context.queryClient.ensureQueryData(
            getOrganizationQueryOptions(routeClient, quote.organizationId),
          )
        : Promise.resolve(),
      quote.pipelineId
        ? context.queryClient.ensureQueryData(
            getPipelineQueryOptions(routeClient, quote.pipelineId),
          )
        : Promise.resolve(),
      quote.pipelineId
        ? context.queryClient.ensureQueryData(
            getStagesQueryOptions(routeClient, { pipelineId: quote.pipelineId, limit: 100 }),
          )
        : Promise.resolve(),
      context.queryClient.ensureQueryData(
        getActivitiesQueryOptions(routeClient, {
          entityType: "quote",
          entityId: params.id,
          limit: 50,
        }),
      ),
      context.queryClient.ensureQueryData(
        getQuoteVersionsQueryOptions(routeClient, { quoteId: params.id, limit: 50 }),
      ),
    ])
  },
  component: QuoteDetailRoute,
})

function QuoteDetailRoute() {
  const { id } = Route.useParams()
  useQuote(id)
  return <QuoteDetailPage id={id} />
}

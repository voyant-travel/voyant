import { createFileRoute } from "@tanstack/react-router"
import {
  defaultFetcher,
  getPipelinesQueryOptions,
  getQuotesQueryOptions,
  getStagesQueryOptions,
} from "@voyantjs/crm-react"
import { QuotesKanbanPage } from "@/components/voyant/crm/quotes-page"
import { getApiUrl } from "@/lib/env"

const routeClient = { baseUrl: getApiUrl(), fetcher: defaultFetcher }

export const Route = createFileRoute("/_workspace/quotes/")({
  loader: async ({ context }) => {
    const pipelinesResponse = await context.queryClient.ensureQueryData(
      getPipelinesQueryOptions(routeClient, { entityType: "quote", limit: 50 }),
    )
    const pipelines = pipelinesResponse.data ?? []
    const defaultPipeline = pipelines.find((pipeline) => pipeline.isDefault) ?? pipelines[0]

    if (defaultPipeline) {
      await Promise.all([
        context.queryClient.ensureQueryData(
          getStagesQueryOptions(routeClient, { pipelineId: defaultPipeline.id, limit: 100 }),
        ),
        context.queryClient.ensureQueryData(
          getQuotesQueryOptions(routeClient, {
            pipelineId: defaultPipeline.id,
            status: "open",
            limit: 500,
          }),
        ),
      ])
    }
  },
  component: QuotesKanbanPage,
})

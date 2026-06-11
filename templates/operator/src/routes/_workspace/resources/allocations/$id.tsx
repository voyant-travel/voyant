import { createFileRoute } from "@tanstack/react-router"
import { ResourceAllocationDetailHost } from "@voyantjs/resources-react/admin"
import {
  ensureResourceAllocationDetailPageData,
  ResourceAllocationDetailSkeleton,
} from "@voyantjs/resources-react/ui"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

const resourcesClient = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

export const Route = createFileRoute("/_workspace/resources/allocations/$id")({
  ssr: "data-only",
  loader: ({ context, params }) =>
    ensureResourceAllocationDetailPageData(context.queryClient, resourcesClient, params.id),
  pendingComponent: ResourceAllocationDetailSkeleton,
  component: ResourceAllocationDetailRoute,
})

function ResourceAllocationDetailRoute() {
  const { id } = Route.useParams()
  return <ResourceAllocationDetailHost id={id} />
}

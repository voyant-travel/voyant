import { createFileRoute } from "@tanstack/react-router"
import {
  ensureResourcePoolDetailPageData,
  ResourcePoolDetailSkeleton,
} from "@voyantjs/resources-ui"
import { ResourcePoolDetailHost } from "@voyantjs/resources-ui/admin"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

const resourcesClient = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

export const Route = createFileRoute("/_workspace/resources/pools/$id")({
  ssr: "data-only",
  loader: ({ context, params }) =>
    ensureResourcePoolDetailPageData(context.queryClient, resourcesClient, params.id),
  pendingComponent: ResourcePoolDetailSkeleton,
  component: ResourcePoolDetailRoute,
})

function ResourcePoolDetailRoute() {
  const { id } = Route.useParams()
  return <ResourcePoolDetailHost id={id} />
}

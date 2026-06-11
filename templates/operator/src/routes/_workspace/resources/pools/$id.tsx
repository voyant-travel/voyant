import { createFileRoute } from "@tanstack/react-router"
import { ResourcePoolDetailHost } from "@voyantjs/resources-react/admin"
import {
  ensureResourcePoolDetailPageData,
  ResourcePoolDetailSkeleton,
} from "@voyantjs/resources-react/ui"
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

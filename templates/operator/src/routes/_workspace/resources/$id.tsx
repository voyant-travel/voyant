import { createFileRoute } from "@tanstack/react-router"
import { ResourceDetailHost } from "@voyantjs/resources-react/admin"
import { ensureResourceDetailPageData, ResourceDetailSkeleton } from "@voyantjs/resources-react/ui"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

const resourcesClient = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

export const Route = createFileRoute("/_workspace/resources/$id")({
  ssr: "data-only",
  loader: ({ context, params }) =>
    ensureResourceDetailPageData(context.queryClient, resourcesClient, params.id),
  pendingComponent: ResourceDetailSkeleton,
  component: ResourceDetailRoute,
})

function ResourceDetailRoute() {
  const { id } = Route.useParams()
  return <ResourceDetailHost id={id} />
}

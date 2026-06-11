import { createFileRoute } from "@tanstack/react-router"
import { ResourceAssignmentDetailHost } from "@voyantjs/resources-react/admin"
import {
  ensureResourceAssignmentDetailPageData,
  ResourceAssignmentDetailSkeleton,
} from "@voyantjs/resources-react/ui"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

const resourcesClient = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

export const Route = createFileRoute("/_workspace/resources/assignments/$id")({
  ssr: "data-only",
  loader: ({ context, params }) =>
    ensureResourceAssignmentDetailPageData(context.queryClient, resourcesClient, params.id),
  pendingComponent: ResourceAssignmentDetailSkeleton,
  component: ResourceAssignmentDetailRoute,
})

function ResourceAssignmentDetailRoute() {
  const { id } = Route.useParams()
  return <ResourceAssignmentDetailHost id={id} />
}

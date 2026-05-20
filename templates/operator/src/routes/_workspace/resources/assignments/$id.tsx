import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { resourcesQueryKeys } from "@voyantjs/resources-react"
import {
  ensureResourceAssignmentDetailPageData,
  ResourceAssignmentDetailPage,
  ResourceAssignmentDetailSkeleton,
} from "@voyantjs/resources-ui"
import { api } from "@/lib/api-client"
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
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return (
    <ResourceAssignmentDetailPage
      id={id}
      onBack={() => void navigate({ to: "/resources" })}
      onOpenSlot={(slotId) => void navigate({ to: "/availability/$id", params: { id: slotId } })}
      onOpenResource={(resourceId) =>
        void navigate({ to: "/resources/$id", params: { id: resourceId } })
      }
      onDelete={async (assignment) => {
        await api.delete(`/v1/resources/slot-assignments/${assignment.id}`)
        await queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.assignments() })
        void navigate({ to: "/resources" })
      }}
    />
  )
}

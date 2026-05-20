import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { resourcesQueryKeys } from "@voyantjs/resources-react"
import {
  ensureResourceDetailPageData,
  ResourceDetailPage,
  ResourceDetailSkeleton,
} from "@voyantjs/resources-ui"
import { api } from "@/lib/api-client"
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
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return (
    <ResourceDetailPage
      id={id}
      onBack={() => void navigate({ to: "/resources" })}
      onOpenSupplier={(supplierId) =>
        void navigate({ to: "/suppliers/$id", params: { id: supplierId } })
      }
      onOpenAssignment={(assignmentId) =>
        void navigate({ to: "/resources/assignments/$id", params: { id: assignmentId } })
      }
      onDelete={async (resource) => {
        await api.delete(`/v1/resources/resources/${resource.id}`)
        await queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.resources() })
        void navigate({ to: "/resources" })
      }}
    />
  )
}

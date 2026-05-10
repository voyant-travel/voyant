import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { defaultFetcher, resourcesQueryKeys } from "@voyantjs/resources-react"
import {
  ensureResourceAllocationDetailPageData,
  ResourceAllocationDetailPage,
  ResourceAllocationDetailSkeleton,
} from "@voyantjs/resources-ui"
import { api } from "@/lib/api-client"
import { getApiUrl } from "@/lib/env"

const resourcesClient = { baseUrl: getApiUrl(), fetcher: defaultFetcher }

export const Route = createFileRoute("/_workspace/resources/allocations/$id")({
  loader: ({ context, params }) =>
    ensureResourceAllocationDetailPageData(context.queryClient, resourcesClient, params.id),
  pendingComponent: ResourceAllocationDetailSkeleton,
  component: ResourceAllocationDetailRoute,
})

function ResourceAllocationDetailRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return (
    <ResourceAllocationDetailPage
      id={id}
      onBack={() => void navigate({ to: "/resources" })}
      onOpenPool={(poolId) => void navigate({ to: "/resources/pools/$id", params: { id: poolId } })}
      onOpenProduct={(productId) =>
        void navigate({ to: "/products/$id", params: { id: productId } })
      }
      onDelete={async (allocation) => {
        await api.delete(`/v1/resources/allocations/${allocation.id}`)
        await queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.allocations() })
        void navigate({ to: "/resources" })
      }}
    />
  )
}

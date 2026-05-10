import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { defaultFetcher, resourcesQueryKeys } from "@voyantjs/resources-react"
import {
  ensureResourcePoolDetailPageData,
  ResourcePoolDetailPage,
  ResourcePoolDetailSkeleton,
} from "@voyantjs/resources-ui"
import { api } from "@/lib/api-client"
import { getApiUrl } from "@/lib/env"

const resourcesClient = { baseUrl: getApiUrl(), fetcher: defaultFetcher }

export const Route = createFileRoute("/_workspace/resources/pools/$id")({
  loader: ({ context, params }) =>
    ensureResourcePoolDetailPageData(context.queryClient, resourcesClient, params.id),
  pendingComponent: ResourcePoolDetailSkeleton,
  component: ResourcePoolDetailRoute,
})

function ResourcePoolDetailRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return (
    <ResourcePoolDetailPage
      id={id}
      onBack={() => void navigate({ to: "/resources" })}
      onOpenProduct={(productId) =>
        void navigate({ to: "/products/$id", params: { id: productId } })
      }
      onOpenResource={(resourceId) =>
        void navigate({ to: "/resources/$id", params: { id: resourceId } })
      }
      onOpenAllocation={(allocationId) =>
        void navigate({ to: "/resources/allocations/$id", params: { id: allocationId } })
      }
      onOpenAssignment={(assignmentId) =>
        void navigate({ to: "/resources/assignments/$id", params: { id: assignmentId } })
      }
      onDelete={async (pool) => {
        await api.delete(`/v1/resources/pools/${pool.id}`)
        await queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.pools() })
        void navigate({ to: "/resources" })
      }}
    />
  )
}

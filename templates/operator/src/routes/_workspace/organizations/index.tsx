import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { lazy, Suspense } from "react"
import { getOrganizationsQueryOptions } from "@/components/voyant/crm/crm-query-options"
import { OrganizationsListSkeleton } from "@/components/voyant/crm/organizations-list-skeleton"

const OrganizationsPage = lazy(() =>
  import("@voyantjs/crm-ui/components/organizations-page").then((module) => ({
    default: module.OrganizationsPage,
  })),
)

export const Route = createFileRoute("/_workspace/organizations/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(getOrganizationsQueryOptions({ limit: 25, offset: 0 })),
  pendingComponent: OrganizationsListSkeleton,
  component: OrganizationsRoute,
})

function OrganizationsRoute() {
  const navigate = useNavigate()

  return (
    <Suspense fallback={<OrganizationsListSkeleton />}>
      <OrganizationsPage
        onOrganizationOpen={(organization) =>
          void navigate({ to: "/organizations/$id", params: { id: organization.id } })
        }
      />
    </Suspense>
  )
}

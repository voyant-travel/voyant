import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { OrganizationsPage } from "@voyantjs/crm-ui"
import { getOrganizationsQueryOptions } from "@/components/voyant/crm/crm-query-options"
import { OrganizationsListSkeleton } from "@/components/voyant/crm/organizations-list-skeleton"

export const Route = createFileRoute("/_workspace/organizations/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(getOrganizationsQueryOptions({ limit: 25, offset: 0 })),
  pendingComponent: OrganizationsListSkeleton,
  component: OrganizationsRoute,
})

function OrganizationsRoute() {
  const navigate = useNavigate()

  return (
    <OrganizationsPage
      onOrganizationOpen={(organization) =>
        void navigate({ to: "/organizations/$id", params: { id: organization.id } })
      }
    />
  )
}

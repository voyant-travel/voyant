import { createFileRoute } from "@tanstack/react-router"
import {
  getActivitiesQueryOptions,
  getOrganizationQueryOptions,
  getPeopleQueryOptions,
  getQuotesQueryOptions,
} from "@/components/voyant/crm/crm-query-options"
import { OrganizationDetailPage } from "@/components/voyant/crm/organization-detail-page"
import { OrganizationDetailSkeleton } from "@/components/voyant/crm/organization-detail-skeleton"

export const Route = createFileRoute("/_workspace/organizations/$id")({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(getOrganizationQueryOptions(params.id)),
      context.queryClient.ensureQueryData(
        getPeopleQueryOptions({ organizationId: params.id, limit: 50 }),
      ),
      context.queryClient.ensureQueryData(
        getQuotesQueryOptions({ organizationId: params.id, limit: 50 }),
      ),
      context.queryClient.ensureQueryData(
        getActivitiesQueryOptions({
          entityType: "organization",
          entityId: params.id,
          limit: 50,
        }),
      ),
    ])
  },
  pendingComponent: OrganizationDetailSkeleton,
  component: OrganizationDetailRoute,
})

function OrganizationDetailRoute() {
  const { id } = Route.useParams()
  return <OrganizationDetailPage id={id} />
}

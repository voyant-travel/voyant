import { createFileRoute } from "@tanstack/react-router"
import {
  defaultFetcher,
  getActivitiesQueryOptions,
  getOrganizationQueryOptions,
  getPeopleQueryOptions,
  getQuotesQueryOptions,
} from "@voyantjs/crm-react"
import { OrganizationDetailPage } from "@/components/voyant/crm/organization-detail-page"
import { getApiUrl } from "@/lib/env"

const routeClient = { baseUrl: getApiUrl(), fetcher: defaultFetcher }

export const Route = createFileRoute("/_workspace/organizations/$id")({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(getOrganizationQueryOptions(routeClient, params.id)),
      context.queryClient.ensureQueryData(
        getPeopleQueryOptions(routeClient, { organizationId: params.id, limit: 50 }),
      ),
      context.queryClient.ensureQueryData(
        getQuotesQueryOptions(routeClient, { organizationId: params.id, limit: 50 }),
      ),
      context.queryClient.ensureQueryData(
        getActivitiesQueryOptions(routeClient, {
          entityType: "organization",
          entityId: params.id,
          limit: 50,
        }),
      ),
    ])
  },
  component: OrganizationDetailRoute,
})

function OrganizationDetailRoute() {
  const { id } = Route.useParams()
  return <OrganizationDetailPage id={id} />
}

import { createFileRoute } from "@tanstack/react-router"
import {
  getActivitiesQueryOptions,
  getOrganizationQueryOptions,
  getPeopleQueryOptions,
  getQuotesQueryOptions,
} from "@voyantjs/crm-react"
import { OrganizationDetailHost, OrganizationDetailSkeleton } from "@voyantjs/crm-ui/admin"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// Thin host for the package-delivered organization detail page
// (packaged-admin RFC Phase 3). Page, data wiring, breadcrumbs, and
// navigation (semantic destinations, RFC §4.7) are package-owned; this file
// only binds the route param onto the host.
export const Route = createFileRoute("/_workspace/organizations/$id")({
  loader: async ({ context, params }) => {
    const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

    await Promise.all([
      context.queryClient.ensureQueryData(getOrganizationQueryOptions(client, params.id)),
      context.queryClient.ensureQueryData(
        getPeopleQueryOptions(client, { organizationId: params.id, limit: 50 }),
      ),
      context.queryClient.ensureQueryData(
        getQuotesQueryOptions(client, { organizationId: params.id, limit: 50 }),
      ),
      context.queryClient.ensureQueryData(
        getActivitiesQueryOptions(client, {
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
  return <OrganizationDetailHost id={id} />
}

import { createFileRoute } from "@tanstack/react-router"
import { getOrganizationQueryOptions, getPersonQueryOptions } from "@voyantjs/crm-react"
import { PersonDetailHost, PersonDetailSkeleton } from "@voyantjs/crm-react/admin"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// Thin host for the package-delivered person detail page (packaged-admin RFC
// Phase 3). Page, data wiring, and navigation (semantic destinations, RFC
// §4.7) are package-owned; this file only binds the route param onto the
// host. The Bookings tab arrives as bookings-ui's widget contribution on the
// `person.details.bookings-tab` slot.
export const Route = createFileRoute("/_workspace/people/$id")({
  loader: async ({ context, params }) => {
    const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }
    const person = await context.queryClient.ensureQueryData(
      getPersonQueryOptions(client, params.id),
    )

    if (person.organizationId) {
      await context.queryClient.ensureQueryData(
        getOrganizationQueryOptions(client, person.organizationId),
      )
    }
  },
  pendingComponent: PersonDetailSkeleton,
  component: PersonDetailRoute,
})

function PersonDetailRoute() {
  const { id } = Route.useParams()
  return <PersonDetailHost id={id} />
}

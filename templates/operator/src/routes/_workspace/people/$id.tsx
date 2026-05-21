import { createFileRoute } from "@tanstack/react-router"
import {
  getOrganizationQueryOptions,
  getPersonQueryOptions,
} from "@/components/voyant/crm/crm-query-options"
import { PersonDetailPage } from "@/components/voyant/crm/person-detail-page"
import { PersonDetailSkeleton } from "@/components/voyant/crm/person-detail-skeleton"

export const Route = createFileRoute("/_workspace/people/$id")({
  loader: async ({ context, params }) => {
    const person = await context.queryClient.ensureQueryData(getPersonQueryOptions(params.id))

    if (person.organizationId) {
      await context.queryClient.ensureQueryData(getOrganizationQueryOptions(person.organizationId))
    }
  },
  pendingComponent: PersonDetailSkeleton,
  component: PersonDetailRoute,
})

function PersonDetailRoute() {
  const { id } = Route.useParams()
  return <PersonDetailPage id={id} />
}

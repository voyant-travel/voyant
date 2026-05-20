import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { PeoplePage } from "@voyantjs/crm-ui"
import { getPeopleQueryOptions } from "@/components/voyant/crm/crm-query-options"
import { PeopleListSkeleton } from "@/components/voyant/crm/people-list-skeleton"

export const Route = createFileRoute("/_workspace/people/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(getPeopleQueryOptions({ limit: 25, offset: 0 })),
  pendingComponent: PeopleListSkeleton,
  component: PeopleRoute,
})

function PeopleRoute() {
  const navigate = useNavigate()

  return (
    <PeoplePage
      onPersonOpen={(person) => void navigate({ to: "/people/$id", params: { id: person.id } })}
    />
  )
}

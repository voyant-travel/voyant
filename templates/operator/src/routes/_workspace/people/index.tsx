import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { lazy, Suspense } from "react"
import { getPeopleQueryOptions } from "@/components/voyant/crm/crm-query-options"
import { PeopleListSkeleton } from "@/components/voyant/crm/people-list-skeleton"

const PeoplePage = lazy(() =>
  import("@voyantjs/crm-ui/components/people-page").then((module) => ({
    default: module.PeoplePage,
  })),
)

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
    <Suspense fallback={<PeopleListSkeleton />}>
      <PeoplePage
        onPersonOpen={(person) => void navigate({ to: "/people/$id", params: { id: person.id } })}
      />
    </Suspense>
  )
}

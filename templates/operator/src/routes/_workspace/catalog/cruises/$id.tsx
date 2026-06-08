import { createFileRoute } from "@tanstack/react-router"

import { OperatorCruiseDetail } from "@/components/voyant/catalog/operator-cruise-detail"

export const Route = createFileRoute("/_workspace/catalog/cruises/$id")({
  component: CruiseDetailRoute,
})

function CruiseDetailRoute() {
  const { id } = Route.useParams()
  return <OperatorCruiseDetail id={id} />
}

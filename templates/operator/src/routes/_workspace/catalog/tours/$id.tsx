import { createFileRoute } from "@tanstack/react-router"

import { OperatorVerticalDetail } from "@/components/voyant/catalog/operator-vertical-detail"

export const Route = createFileRoute("/_workspace/catalog/tours/$id")({
  component: TourDetailRoute,
})

function TourDetailRoute() {
  const { id } = Route.useParams()
  return <OperatorVerticalDetail surface="tours" id={id} />
}

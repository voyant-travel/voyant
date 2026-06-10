import { createFileRoute } from "@tanstack/react-router"

import { OperatorVerticalDetail } from "@/components/voyant/catalog/operator-vertical-detail"

export const Route = createFileRoute("/_workspace/catalog/accommodations/$id")({
  component: AccommodationDetailRoute,
})

function AccommodationDetailRoute() {
  const { id } = Route.useParams()
  return <OperatorVerticalDetail surface="accommodations" id={id} />
}

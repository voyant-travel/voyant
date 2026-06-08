import { createFileRoute } from "@tanstack/react-router"

import { OperatorVerticalDetail } from "@/components/voyant/catalog/operator-vertical-detail"

export const Route = createFileRoute("/_workspace/catalog/excursions/$id")({
  component: ExcursionDetailRoute,
})

function ExcursionDetailRoute() {
  const { id } = Route.useParams()
  return <OperatorVerticalDetail surface="excursions" id={id} />
}

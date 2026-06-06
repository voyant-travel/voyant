import { createFileRoute } from "@tanstack/react-router"

import { CatalogVerticalDetailPage } from "@/components/voyant/catalog/catalog-vertical-detail-page"

export const Route = createFileRoute("/_workspace/catalog/accommodations/$id")({
  component: AccommodationDetailRoute,
})

function AccommodationDetailRoute() {
  const { id } = Route.useParams()
  return <CatalogVerticalDetailPage surface="accommodations" id={id} />
}

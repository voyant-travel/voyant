import { createFileRoute } from "@tanstack/react-router"

import { CatalogVerticalDetailPage } from "@/components/voyant/catalog/catalog-vertical-detail-page"

export const Route = createFileRoute("/_workspace/catalog/tours/$id")({
  component: TourDetailRoute,
})

function TourDetailRoute() {
  const { id } = Route.useParams()
  return <CatalogVerticalDetailPage surface="tours" id={id} />
}

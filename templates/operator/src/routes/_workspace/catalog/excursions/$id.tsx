import { createFileRoute } from "@tanstack/react-router"

import { CatalogVerticalDetailPage } from "@/components/voyant/catalog/catalog-vertical-detail-page"

export const Route = createFileRoute("/_workspace/catalog/excursions/$id")({
  component: ExcursionDetailRoute,
})

function ExcursionDetailRoute() {
  const { id } = Route.useParams()
  return <CatalogVerticalDetailPage surface="excursions" id={id} />
}

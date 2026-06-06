import { createFileRoute } from "@tanstack/react-router"

import { CruiseDetailPage } from "@/components/voyant/catalog/cruise-detail-page"

export const Route = createFileRoute("/_workspace/catalog/cruises/$id")({
  component: CruiseDetailRoute,
})

function CruiseDetailRoute() {
  const { id } = Route.useParams()
  return <CruiseDetailPage id={id} />
}

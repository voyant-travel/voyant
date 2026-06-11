import { createFileRoute } from "@tanstack/react-router"
import { VerticalDetailHost } from "@voyantjs/catalog-ui/admin"

// Thin host for the package-delivered vertical detail page (packaged-admin
// RFC Phase 2). This file only binds the route param + surface.
export const Route = createFileRoute("/_workspace/catalog/accommodations/$id")({
  component: AccommodationDetailRoute,
})

function AccommodationDetailRoute() {
  const { id } = Route.useParams()
  return <VerticalDetailHost surface="accommodations" id={id} />
}

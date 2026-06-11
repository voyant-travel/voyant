import { createFileRoute } from "@tanstack/react-router"
import { VerticalDetailHost } from "@voyantjs/catalog-react/admin"

// Thin host for the package-delivered vertical detail page (packaged-admin
// RFC Phase 2). This file only binds the route param + surface.
export const Route = createFileRoute("/_workspace/catalog/tours/$id")({
  component: TourDetailRoute,
})

function TourDetailRoute() {
  const { id } = Route.useParams()
  return <VerticalDetailHost surface="tours" id={id} />
}

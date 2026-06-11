import { createFileRoute } from "@tanstack/react-router"
import { CruiseDetailHost } from "@voyantjs/catalog-react/admin"

// Thin host for the package-delivered cruise detail page (packaged-admin RFC
// Phase 2). Navigation into the booking journey resolves through semantic
// destinations (RFC §4.7); this file only binds the route param.
export const Route = createFileRoute("/_workspace/catalog/cruises/$id")({
  component: CruiseDetailRoute,
})

function CruiseDetailRoute() {
  const { id } = Route.useParams()
  return <CruiseDetailHost id={id} />
}

import { createFileRoute } from "@tanstack/react-router"
import {
  type CatalogSearchParams,
  catalogSearchSchema,
  ScheduledCatalogHost,
} from "@voyantjs/catalog-ui/admin"

// Thin host for the package-delivered scheduled catalog page (packaged-admin
// RFC Phase 2). This file only binds the route's URL search state.
export const Route = createFileRoute("/_workspace/catalog/excursions/")({
  validateSearch: catalogSearchSchema,
  component: CatalogExcursionsRoute,
})

function CatalogExcursionsRoute() {
  const search = Route.useSearch()
  const routeNavigate = Route.useNavigate()

  // Excursions = single-day scheduled trips (durationDays ≤ 1).
  return (
    <ScheduledCatalogHost
      scope="excursions"
      search={search}
      onSearchChange={(updater, replace = true) =>
        void routeNavigate({
          search: (prev): CatalogSearchParams => updater(prev),
          replace,
        })
      }
    />
  )
}

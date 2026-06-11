import { createFileRoute } from "@tanstack/react-router"
import {
  type CatalogSearchParams,
  catalogSearchSchema,
  ScheduledCatalogHost,
} from "@voyantjs/catalog-ui/admin"

// Thin host for the package-delivered scheduled catalog page (packaged-admin
// RFC Phase 2). This file only binds the route's URL search state.
export const Route = createFileRoute("/_workspace/catalog/tours/")({
  validateSearch: catalogSearchSchema,
  component: CatalogToursRoute,
})

function CatalogToursRoute() {
  const search = Route.useSearch()
  const routeNavigate = Route.useNavigate()

  // Tours / circuits = multi-day scheduled trips (durationDays ≥ 2).
  return (
    <ScheduledCatalogHost
      scope="tours"
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

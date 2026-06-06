import { createFileRoute } from "@tanstack/react-router"

import {
  type CatalogSearchParams,
  catalogSearchSchema,
} from "@/components/voyant/catalog/catalog-route-state"
import { ScheduledCatalogPage } from "@/components/voyant/catalog/scheduled-catalog-page"

export const Route = createFileRoute("/_workspace/catalog/excursions/")({
  validateSearch: catalogSearchSchema,
  component: CatalogExcursionsRoute,
})

function CatalogExcursionsRoute() {
  const search = Route.useSearch()
  const routeNavigate = Route.useNavigate()

  // Excursions = single-day scheduled trips (durationDays ≤ 1).
  return (
    <ScheduledCatalogPage
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

import { createFileRoute } from "@tanstack/react-router"

import {
  type CatalogSearchParams,
  catalogSearchSchema,
} from "@/components/voyant/catalog/catalog-route-state"
import { ScheduledCatalogPage } from "@/components/voyant/catalog/scheduled-catalog-page"

export const Route = createFileRoute("/_workspace/catalog/tours/")({
  validateSearch: catalogSearchSchema,
  component: CatalogToursRoute,
})

function CatalogToursRoute() {
  const search = Route.useSearch()
  const routeNavigate = Route.useNavigate()

  // Tours / circuits = multi-day scheduled trips (durationDays ≥ 2).
  return (
    <ScheduledCatalogPage
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

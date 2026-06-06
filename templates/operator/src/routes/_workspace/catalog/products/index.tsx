import { createFileRoute } from "@tanstack/react-router"
import {
  type CatalogSearchParams,
  catalogSearchSchema,
} from "@/components/voyant/catalog/catalog-route-state"
import { DynamicCatalogPage } from "@/components/voyant/catalog/dynamic-catalog-page"

export const Route = createFileRoute("/_workspace/catalog/products/")({
  validateSearch: catalogSearchSchema,
  component: CatalogProductsRoute,
})

function CatalogProductsRoute() {
  const search = Route.useSearch()
  const routeNavigate = Route.useNavigate()

  // Products are the `dynamic` supply mechanic → search-first surface.
  return (
    <DynamicCatalogPage
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

import { createFileRoute } from "@tanstack/react-router"
import {
  type CatalogSearchParams,
  catalogSearchSchema,
  DynamicCatalogHost,
} from "@voyantjs/catalog-ui/admin"

// Thin host for the package-delivered dynamic catalog page (packaged-admin
// RFC Phase 2). Page and search contract are package-owned; this file only
// binds the route's URL search state onto the host's props.
export const Route = createFileRoute("/_workspace/catalog/products/")({
  validateSearch: catalogSearchSchema,
  component: CatalogProductsRoute,
})

function CatalogProductsRoute() {
  const search = Route.useSearch()
  const routeNavigate = Route.useNavigate()

  // Products are the `dynamic` supply mechanic → search-first surface.
  return (
    <DynamicCatalogHost
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

import { createFileRoute } from "@tanstack/react-router"

import { CatalogVerticalPage } from "@/components/voyant/catalog/catalog-page"
import {
  type CatalogSearchParams,
  catalogSearchSchema,
  openCatalogDetail,
} from "@/components/voyant/catalog/catalog-route-state"
import { useAdminMessages } from "@/lib/admin-i18n"

export const Route = createFileRoute("/_workspace/catalog/accommodations/")({
  validateSearch: catalogSearchSchema,
  component: CatalogAccommodationsRoute,
})

function CatalogAccommodationsRoute() {
  const search = Route.useSearch()
  const routeNavigate = Route.useNavigate()
  const nav = useAdminMessages().nav

  // Browse-first surface — a consistent header over the embedded grid, with
  // results opening the dedicated accommodation detail page in a new tab.
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-6 py-6 lg:px-8">
      <div className="mb-4">
        <h1 className="font-semibold text-2xl">{nav.catalogAccommodations}</h1>
      </div>
      <CatalogVerticalPage
        vertical="accommodations"
        search={search}
        onSearchChange={(updater, replace = true) =>
          void routeNavigate({
            search: (prev): CatalogSearchParams => updater(prev),
            replace,
          })
        }
        embedded
        onOpenDetail={(hit) => openCatalogDetail("accommodations", hit.id)}
      />
    </div>
  )
}

import { createFileRoute } from "@tanstack/react-router"

import { CatalogVerticalPage } from "@/components/voyant/catalog/catalog-page"
import {
  type CatalogSearchParams,
  catalogSearchSchema,
  openCatalogDetail,
} from "@/components/voyant/catalog/catalog-route-state"
import { useAdminMessages } from "@/lib/admin-i18n"

export const Route = createFileRoute("/_workspace/catalog/cruises/")({
  validateSearch: catalogSearchSchema,
  component: CatalogCruisesRoute,
})

function CatalogCruisesRoute() {
  const search = Route.useSearch()
  const routeNavigate = Route.useNavigate()
  const nav = useAdminMessages().nav

  // Browse-first surface — a consistent header over the embedded grid, with
  // results opening the dedicated, source-driven cruise detail in a new tab.
  // (Connect's cruise sailings carry no from-price and don't join cleanly for a
  // live availability calendar, so cruises browse the synced catalog index.)
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-6 py-6 lg:px-8">
      <div className="mb-4">
        <h1 className="font-semibold text-2xl">{nav.catalogCruises}</h1>
      </div>
      <CatalogVerticalPage
        vertical="cruises"
        search={search}
        onSearchChange={(updater, replace = true) =>
          void routeNavigate({
            search: (prev): CatalogSearchParams => updater(prev),
            replace,
          })
        }
        embedded
        onOpenDetail={(hit) => openCatalogDetail("cruises", hit.id)}
      />
    </div>
  )
}

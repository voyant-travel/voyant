"use client"

import { useAdminHref, useOperatorAdminMessages } from "@voyant-travel/admin"
import { CatalogVerticalHost } from "../catalog-vertical-host.js"
import type { CatalogAdminRoutePageProps, CatalogSearchParams } from "../index.js"
import { openHrefInNewTab } from "../open-in-new-tab.js"

/**
 * Packaged route page for the cruises browse surface. The header title is read
 * from the localized operator nav messages (the `title` prop carries the
 * static contribution label, which is not locale-resolved — the route tree is
 * built once from the English defaults); `search` was validated by the
 * contribution's `validateSearch` (catalogSearchSchema).
 */
export default function CatalogCruisesIndexPage({
  search,
  updateSearch,
  scopeOptions,
}: CatalogAdminRoutePageProps) {
  const resolveHref = useAdminHref()
  const title = useOperatorAdminMessages().nav.catalogCruises

  // Browse-first surface — a consistent header over the embedded grid, with
  // results opening the dedicated, source-driven cruise detail (the
  // `catalog.detail` destination) in a new tab. (Connect's cruise sailings
  // carry no from-price and don't join cleanly for a live availability
  // calendar, so cruises browse the synced catalog index.)
  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <div className="mb-4">
        <h1 className="font-semibold text-2xl">{title}</h1>
      </div>
      <CatalogVerticalHost
        vertical="cruises"
        search={search as CatalogSearchParams}
        onSearchChange={(updater, replace = true) => updateSearch(updater as never, { replace })}
        embedded
        scopeOptions={scopeOptions}
        onOpenDetail={(hit) =>
          openHrefInNewTab(resolveHref("catalog.detail", { surface: "cruises", id: hit.id }))
        }
      />
    </div>
  )
}

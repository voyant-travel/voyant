"use client"

import { useAdminHref, useOperatorAdminMessages } from "@voyant-travel/admin"
import { CatalogVerticalHost } from "../catalog-vertical-host.js"
import type { CatalogAdminRoutePageProps, CatalogSearchParams } from "../index.js"
import { openHrefInNewTab } from "../open-in-new-tab.js"

/**
 * Packaged route page for the accommodations browse surface. The header title
 * is read from the localized operator nav messages (the `title` prop carries
 * the static contribution label, which is not locale-resolved — the route tree
 * is built once from the English defaults); `search` was validated by the
 * contribution's `validateSearch` (catalogSearchSchema).
 */
export default function CatalogAccommodationsIndexPage({
  search,
  updateSearch,
  scopeOptions,
}: CatalogAdminRoutePageProps) {
  const resolveHref = useAdminHref()
  const title = useOperatorAdminMessages().nav.catalogAccommodations

  // Browse-first surface — a consistent header over the embedded grid, with
  // results opening the dedicated accommodation detail page (the
  // `catalog.detail` destination) in a new tab.
  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <div className="mb-4">
        <h1 className="font-semibold text-2xl">{title}</h1>
      </div>
      <CatalogVerticalHost
        vertical="accommodations"
        search={search as CatalogSearchParams}
        onSearchChange={(updater, replace = true) => updateSearch(updater as never, { replace })}
        embedded
        scopeOptions={scopeOptions}
        onOpenDetail={(hit) =>
          openHrefInNewTab(resolveHref("catalog.detail", { surface: "accommodations", id: hit.id }))
        }
      />
    </div>
  )
}

"use client"

import { type AdminRoutePageProps, useAdminHref } from "@voyantjs/admin"

import type { CatalogSearchParams } from "../../index.js"
import { CatalogVerticalHost } from "../catalog-vertical-host.js"
import { openHrefInNewTab } from "../open-in-new-tab.js"

/**
 * Packaged route page for the accommodations browse surface. `title` is the
 * contribution's localized label (factory `labels`); `search` was validated
 * by the contribution's `validateSearch` (catalogSearchSchema).
 */
export default function CatalogAccommodationsIndexPage({
  search,
  updateSearch,
  title,
}: AdminRoutePageProps) {
  const resolveHref = useAdminHref()

  // Browse-first surface — a consistent header over the embedded grid, with
  // results opening the dedicated accommodation detail page (the
  // `catalog.detail` destination) in a new tab.
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-6 py-6 lg:px-8">
      <div className="mb-4">
        <h1 className="font-semibold text-2xl">{title}</h1>
      </div>
      <CatalogVerticalHost
        vertical="accommodations"
        search={search as CatalogSearchParams}
        onSearchChange={(updater, replace = true) => updateSearch(updater as never, { replace })}
        embedded
        onOpenDetail={(hit) =>
          openHrefInNewTab(resolveHref("catalog.detail", { surface: "accommodations", id: hit.id }))
        }
      />
    </div>
  )
}

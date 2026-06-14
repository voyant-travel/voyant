"use client"

import { type AdminRoutePageProps, useAdminHref } from "@voyant-travel/admin"

import type { CatalogSearchParams } from "../../index.js"
import { CatalogVerticalHost } from "../catalog-vertical-host.js"
import { openHrefInNewTab } from "../open-in-new-tab.js"

/**
 * Packaged route page for the cruises browse surface. `title` is the
 * contribution's localized label (factory `labels`); `search` was validated
 * by the contribution's `validateSearch` (catalogSearchSchema).
 */
export default function CatalogCruisesIndexPage({
  search,
  updateSearch,
  title,
}: AdminRoutePageProps) {
  const resolveHref = useAdminHref()

  // Browse-first surface — a consistent header over the embedded grid, with
  // results opening the dedicated, source-driven cruise detail (the
  // `catalog.detail` destination) in a new tab. (Connect's cruise sailings
  // carry no from-price and don't join cleanly for a live availability
  // calendar, so cruises browse the synced catalog index.)
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-6 py-6 lg:px-8">
      <div className="mb-4">
        <h1 className="font-semibold text-2xl">{title}</h1>
      </div>
      <CatalogVerticalHost
        vertical="cruises"
        search={search as CatalogSearchParams}
        onSearchChange={(updater, replace = true) => updateSearch(updater as never, { replace })}
        embedded
        onOpenDetail={(hit) =>
          openHrefInNewTab(resolveHref("catalog.detail", { surface: "cruises", id: hit.id }))
        }
      />
    </div>
  )
}

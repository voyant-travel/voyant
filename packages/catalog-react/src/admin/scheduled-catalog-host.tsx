"use client"

import { useAdminHref, useOperatorAdminMessages } from "@voyantjs/admin"
import {
  ScheduledCatalogPage as ScheduledCatalogPageUi,
  type ScheduledScope,
} from "../components/scheduled-catalog-page.js"
import type { CatalogSearchParams } from "../index.js"
import { CatalogVerticalHost } from "./catalog-vertical-host.js"
import { openHrefInNewTab } from "./open-in-new-tab.js"

export interface ScheduledCatalogHostProps {
  scope: ScheduledScope
  search: CatalogSearchParams
  onSearchChange: (
    updater: (prev: CatalogSearchParams) => CatalogSearchParams,
    replace?: boolean,
  ) => void
}

/**
 * Packaged admin host for `ScheduledCatalogPage` — supplies the localized
 * title/tagline and renders `CatalogVerticalHost` (markets/suppliers/products
 * wiring) as the embedded browse grid, opening each result's vertical detail
 * page (the `catalog.detail` destination) in a new tab on click.
 */
export function ScheduledCatalogHost({ scope, search, onSearchChange }: ScheduledCatalogHostProps) {
  const resolveHref = useAdminHref()
  const nav = useOperatorAdminMessages().nav
  const title = scope === "excursions" ? nav.catalogExcursions : nav.catalogTours
  const subtitle = scope === "excursions" ? nav.catalogExcursionsTagline : nav.catalogToursTagline

  return (
    <ScheduledCatalogPageUi
      scope={scope}
      title={title}
      subtitle={subtitle}
      renderBrowseGrid={({ lockedFacets, lockedRanges }) => (
        <CatalogVerticalHost
          vertical="products"
          search={search}
          onSearchChange={onSearchChange}
          embedded
          lockedFacets={lockedFacets}
          lockedRanges={lockedRanges}
          onOpenDetail={(hit) =>
            openHrefInNewTab(resolveHref("catalog.detail", { surface: scope, id: hit.id }))
          }
        />
      )}
    />
  )
}

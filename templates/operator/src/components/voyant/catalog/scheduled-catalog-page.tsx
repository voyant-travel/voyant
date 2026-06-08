"use client"

import {
  ScheduledCatalogPage as ScheduledCatalogPageUi,
  type ScheduledScope,
} from "@voyantjs/catalog-ui"

import { useAdminMessages } from "@/lib/admin-i18n"
import { CatalogVerticalPage } from "./catalog-page"
import { type CatalogSearchParams, openCatalogDetail } from "./catalog-route-state"

export type { ScheduledScope }

/**
 * Operator host for the packaged `ScheduledCatalogPage` — supplies the
 * localized title/tagline and renders the operator's `CatalogVerticalPage`
 * (markets/suppliers/products wiring) as the embedded browse grid, opening each
 * result's vertical detail page on click.
 */
export function ScheduledCatalogPage({
  scope,
  search,
  onSearchChange,
}: {
  scope: ScheduledScope
  search: CatalogSearchParams
  onSearchChange: (
    updater: (prev: CatalogSearchParams) => CatalogSearchParams,
    replace?: boolean,
  ) => void
}) {
  const nav = useAdminMessages().nav
  const title = scope === "excursions" ? nav.catalogExcursions : nav.catalogTours
  const subtitle = scope === "excursions" ? nav.catalogExcursionsTagline : nav.catalogToursTagline

  return (
    <ScheduledCatalogPageUi
      scope={scope}
      title={title}
      subtitle={subtitle}
      renderBrowseGrid={({ lockedFacets, lockedRanges }) => (
        <CatalogVerticalPage
          vertical="products"
          search={search}
          onSearchChange={onSearchChange}
          embedded
          lockedFacets={lockedFacets}
          lockedRanges={lockedRanges}
          onOpenDetail={(hit) => openCatalogDetail(scope, hit.id)}
        />
      )}
    />
  )
}

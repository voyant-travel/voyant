"use client"

import { DynamicCatalogHost } from "../dynamic-catalog-host.js"
import type { CatalogAdminRoutePageProps, CatalogSearchParams } from "../index.js"

/**
 * Packaged route page for the dynamic catalog browse surface (Packages).
 * The contribution's `validateSearch` (catalogSearchSchema) already validated
 * `search`, so the cast onto the host's search contract is sound.
 */
export default function CatalogProductsIndexPage({
  search,
  updateSearch,
  scopeOptions,
}: CatalogAdminRoutePageProps) {
  // Products are the `dynamic` supply mechanic → search-first surface.
  return (
    <DynamicCatalogHost
      search={search as CatalogSearchParams}
      onSearchChange={(updater, replace = true) => updateSearch(updater as never, { replace })}
      scopeOptions={scopeOptions}
    />
  )
}

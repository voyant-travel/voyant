"use client"

import type { AdminRoutePageProps } from "@voyant-travel/admin"

import type { CatalogSearchParams } from "../../index.js"
import { DynamicCatalogHost } from "../dynamic-catalog-host.js"

/**
 * Packaged route page for the dynamic catalog browse surface (Packages).
 * The contribution's `validateSearch` (catalogSearchSchema) already validated
 * `search`, so the cast onto the host's search contract is sound.
 */
export default function CatalogProductsIndexPage({ search, updateSearch }: AdminRoutePageProps) {
  // Products are the `dynamic` supply mechanic → search-first surface.
  return (
    <DynamicCatalogHost
      search={search as CatalogSearchParams}
      onSearchChange={(updater, replace = true) => updateSearch(updater as never, { replace })}
    />
  )
}

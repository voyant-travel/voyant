"use client"

import type { AdminRoutePageProps } from "@voyant-travel/admin"

import type { CatalogSearchParams } from "../../index.js"
import { ScheduledCatalogHost } from "../scheduled-catalog-host.js"

/**
 * Packaged route page for the scheduled catalog browse surface scoped to
 * tours. The contribution's `validateSearch` (catalogSearchSchema) already
 * validated `search`, so the cast onto the host contract is sound.
 */
export default function CatalogToursIndexPage({ search, updateSearch }: AdminRoutePageProps) {
  // Tours / circuits = multi-day scheduled trips (durationDays ≥ 2).
  return (
    <ScheduledCatalogHost
      scope="tours"
      search={search as CatalogSearchParams}
      onSearchChange={(updater, replace = true) => updateSearch(updater as never, { replace })}
    />
  )
}

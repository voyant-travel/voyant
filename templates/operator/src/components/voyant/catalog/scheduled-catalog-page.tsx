"use client"

import { useAdminMessages } from "@/lib/admin-i18n"
import { CatalogVerticalPage } from "./catalog-page"
import { type CatalogSearchParams, openCatalogDetail } from "./catalog-route-state"

/**
 * Scheduled (fixed-departure) catalog surface — products whose departures are
 * known and finite, so it's a **departures-first browse** (the grid + each
 * product's dated departures and remaining seats/allotment in the detail
 * sheet). Pinned to `supplyModel: scheduled` so it never mixes with
 * dynamically-composed packages, and split by duration:
 *   - `excursions` — single-day trips (`durationDays ≤ 1`)
 *   - `tours`      — multi-day circuits (`durationDays ≥ 2`)
 *
 * See docs/architecture/catalog-supply-models.md (`scheduled` mechanic).
 */
export type ScheduledScope = "excursions" | "tours"

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
  const lockedRanges =
    scope === "excursions" ? { durationDays: { lte: 1 } } : { durationDays: { gte: 2 } }
  const title = scope === "excursions" ? nav.catalogExcursions : nav.catalogTours
  const subtitle = scope === "excursions" ? nav.catalogExcursionsTagline : nav.catalogToursTagline

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-6 py-6 lg:px-8">
      {/* Page header — on top, surface-specific copy. */}
      <div className="mb-4">
        <h1 className="font-semibold text-2xl">{title}</h1>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
      <CatalogVerticalPage
        vertical="products"
        search={search}
        onSearchChange={onSearchChange}
        embedded
        lockedFacets={{ supplyModel: ["scheduled"] }}
        lockedRanges={lockedRanges}
        onOpenDetail={(hit) => openCatalogDetail(scope, hit.id)}
      />
    </div>
  )
}

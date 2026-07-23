"use client"

import type { ReactNode } from "react"

/**
 * Scheduled (fixed-departure) catalog surface — products whose departures are
 * known and finite, so it's a **departures-first browse** (the grid + each
 * product's dated departures and remaining seats/allotment in the detail
 * sheet). Pinned to `supplyModel: scheduled` so it never mixes with
 * dynamically-composed packages, and split by duration:
 *   - `excursions` — single-day trips (`durationDays ≤ 1`)
 *   - `tours`      — multi-day circuits (`durationDays ≥ 2`)
 *
 * Presentational: the localized `title`/`subtitle` and the browse grid itself
 * (`renderBrowseGrid`, the host's `CatalogBrowsePage` wired to its data) are
 * injected. This surface only owns the header layout + the supply-model /
 * duration locks that define the scope.
 */
export type ScheduledScope = "excursions" | "tours"

export interface ScheduledCatalogLocks {
  lockedFacets: Record<string, Array<string | number>>
  lockedRanges: Record<string, { gte?: number; lte?: number }>
}

export interface ScheduledCatalogPageProps {
  scope: ScheduledScope
  /** Localized surface title (e.g. "Excursions" / "Tours"). */
  title: string
  /** Localized surface tagline. */
  subtitle: string
  /** Render the embedded browse grid with the surface's locked filters applied. */
  renderBrowseGrid: (locks: ScheduledCatalogLocks) => ReactNode
}

export function ScheduledCatalogPage({
  scope,
  title,
  subtitle,
  renderBrowseGrid,
}: ScheduledCatalogPageProps) {
  const lockedRanges =
    scope === "excursions" ? { durationDays: { lte: 1 } } : { durationDays: { gte: 2 } }

  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      {/* Page header — on top, surface-specific copy. */}
      <div className="mb-4">
        <h1 className="font-semibold text-2xl">{title}</h1>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
      {renderBrowseGrid({ lockedFacets: { supplyModel: ["scheduled"] }, lockedRanges })}
    </div>
  )
}

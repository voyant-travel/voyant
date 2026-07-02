"use client"

import {
  useAdminBreadcrumbs,
  useAdminHref,
  useAdminNavigate,
  useOperatorAdminMessages,
} from "@voyant-travel/admin"
import { useSuppliers } from "@voyant-travel/distribution-react/suppliers"
import { useMemo, useState } from "react"

import { type CatalogDetailSurface, catalogSurfaceVertical } from "../catalog-surfaces.js"
import {
  type CatalogVerticalDetailBreadcrumb,
  CatalogVerticalDetailPage,
} from "../components/catalog-vertical-detail-page.js"
import { bookingJourneyProvenanceSearchParams } from "./booking-journey-provenance.js"

export interface VerticalDetailHostProps {
  surface: CatalogDetailSurface
  id: string
  locale?: string
}

/**
 * Packaged admin host for `CatalogVerticalDetailPage` — binds the supplier
 * directory, the localized surface label, semantic-destination navigation
 * into the booking journey (packaged-admin RFC §4.7), and breadcrumbs, so
 * host route files stay trivial.
 */
export function VerticalDetailHost({ surface, id, locale }: VerticalDetailHostProps) {
  const resolveHref = useAdminHref()
  const navigateTo = useAdminNavigate()
  const nav = useOperatorAdminMessages().nav
  const vertical = catalogSurfaceVertical(surface)
  const surfaceLabel = surfaceTitle(surface, nav)
  const surfaceHref = resolveHref("catalog.browse", { surface })

  const suppliersQuery = useSuppliers({ limit: 100 })
  const formatSupplier = useMemo(() => {
    const m = new Map<string, string>()
    for (const sup of suppliersQuery.data?.data ?? []) m.set(sup.id, sup.name)
    return (sid: string) => m.get(String(sid)) ?? String(sid)
  }, [suppliersQuery.data])

  // The packaged page resolves the title from content; mirror its breadcrumbs
  // into the admin breadcrumb bar.
  const [crumbs, setCrumbs] = useState<CatalogVerticalDetailBreadcrumb[]>([
    { label: surfaceLabel, href: surfaceHref },
  ])
  useAdminBreadcrumbs(crumbs)

  return (
    <CatalogVerticalDetailPage
      id={id}
      vertical={vertical}
      surfaceLabel={surfaceLabel}
      surfaceHref={surfaceHref}
      locale={locale}
      formatSupplier={formatSupplier}
      onBreadcrumbs={setCrumbs}
      // Vertical detail → the unified journey. Preserve sourced-entry provenance
      // when content enrichment exposed it; otherwise let the journey APIs
      // resolve provenance server-side from (entityModule, entityId).
      onBook={(entityModule, entityId, opts) => {
        return navigateTo("bookingJourney.start", {
          entityModule,
          entityId,
          ...bookingJourneyProvenanceSearchParams(opts),
          ...(opts.departureId ? { departureId: opts.departureId } : {}),
          ...(opts.departureDate ? { departureDate: opts.departureDate.slice(0, 10) } : {}),
          ...(opts.optionId ? { optionId: opts.optionId } : {}),
          ...(opts.name ? { entityName: opts.name } : {}),
          ...(opts.heroImageUrl ? { entityImageUrl: opts.heroImageUrl } : {}),
        })
      }}
    />
  )
}

function surfaceTitle(
  surface: CatalogDetailSurface,
  nav: ReturnType<typeof useOperatorAdminMessages>["nav"],
): string {
  switch (surface) {
    case "cruises":
      return nav.catalogCruises
    case "accommodations":
      return nav.catalogAccommodations
    case "excursions":
      return nav.catalogExcursions
    case "tours":
      return nav.catalogTours
    default:
      return nav.catalogProducts
  }
}

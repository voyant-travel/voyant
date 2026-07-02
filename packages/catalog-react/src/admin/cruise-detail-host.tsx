"use client"

import {
  useAdminBreadcrumbs,
  useAdminHref,
  useAdminNavigate,
  useOperatorAdminMessages,
} from "@voyant-travel/admin"
import { useState } from "react"

import { CruiseDetailPage } from "../components/cruise-detail-page.js"
import { bookingJourneyProvenanceSearchParams } from "./booking-journey-provenance.js"

export interface CruiseDetailHostProps {
  id: string
  locale?: string
}

/**
 * Packaged admin host for `CruiseDetailPage` — injects the localized
 * "Cruises" label, semantic-destination navigation to the booking journey
 * (packaged-admin RFC §4.7), and breadcrumbs.
 */
export function CruiseDetailHost({ id, locale }: CruiseDetailHostProps) {
  const resolveHref = useAdminHref()
  const navigateTo = useAdminNavigate()
  const cruisesLabel = useOperatorAdminMessages().nav.catalogCruises
  const cruisesHref = resolveHref("catalog.browse", { surface: "cruises" })
  const [crumbs, setCrumbs] = useState<Array<{ label: string; href?: string }>>([
    { label: cruisesLabel, href: cruisesHref },
  ])
  useAdminBreadcrumbs(crumbs)

  return (
    <CruiseDetailPage
      id={id}
      locale={locale}
      cruisesLabel={cruisesLabel}
      cruisesHref={cruisesHref}
      onBreadcrumbs={setCrumbs}
      // Cruise detail → the unified journey. Preserve sourced-entry provenance
      // when the content route exposed it; otherwise let the journey APIs
      // resolve provenance server-side from (entityModule, entityId).
      onBook={(cruiseId, opts) => {
        return navigateTo("bookingJourney.start", {
          entityModule: "cruises",
          entityId: cruiseId,
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

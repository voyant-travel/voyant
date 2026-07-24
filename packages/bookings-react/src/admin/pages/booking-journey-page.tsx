"use client"

import type { AdminRoutePageProps } from "@voyant-travel/admin"
import { useMemo } from "react"

import { BookingJourneyHost } from "../booking-journey-host.js"
import type { BookingJourneySearchParams } from "../index.js"

/**
 * Packaged unified booking journey page (packaged-admin RFC §4.8): binds the
 * route's `$entityModule`/`$entityId` params and the journey search contract
 * (`bookingJourneySearchSchema`) onto {@link BookingJourneyHost}. Mounted at
 * `/catalog/journey/$entityModule/$entityId` — a flat path under the
 * workspace layout, so the wizard renders with workspace chrome but OUTSIDE
 * any catalog section nesting (the same semantics the old `catalog_.journey`
 * escaped route file had).
 */
export default function BookingJourneyPage({ params, search }: AdminRoutePageProps) {
  const journeySearch = search as BookingJourneySearchParams
  // Stable draft id — refresh-safe when carried in the URL; generated once
  // per mount otherwise.
  const draftId = useMemo(() => journeySearch.draftId ?? generateDraftId(), [journeySearch.draftId])

  return (
    <div className="mx-auto">
      <BookingJourneyHost
        entityModule={params.entityModule ?? ""}
        entityId={params.entityId ?? ""}
        sourceKind={journeySearch.sourceKind}
        sourceConnectionId={journeySearch.sourceConnectionId}
        sourceRef={journeySearch.sourceRef}
        departureId={journeySearch.departureId}
        departureDate={journeySearch.departureDate}
        optionId={journeySearch.optionId}
        roomTypeId={journeySearch.roomTypeId}
        ratePlanId={journeySearch.ratePlanId}
        board={journeySearch.board}
        entityName={journeySearch.entityName}
        entityImageUrl={journeySearch.entityImageUrl}
        draftId={draftId}
      />
    </div>
  )
}

function generateDraftId(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return `bdrf_${globalThis.crypto.randomUUID().replace(/-/g, "")}`
  }
  return `bdrf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

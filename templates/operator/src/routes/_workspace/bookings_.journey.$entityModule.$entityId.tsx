import { createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"
import { z } from "zod"

import { OperatorBookingJourney } from "@/components/voyant/booking-journey/operator-booking-journey"

/**
 * Unified booking journey route. The shareable wizard from
 * `@voyantjs/bookings-ui/journey`, wrapped with operator slots
 * (CRM picker, B2B default, post-commit nav to /orders/catalog).
 *
 * Per booking-journey-architecture §10 Phase B.
 *
 * This is THE booking page — it lives under `/bookings/journey/...` (not
 * `/catalog/...`) precisely so it reads as the single booking flow, not a
 * catalog-specific feature. Catalog detail/browse pages, the trips composer,
 * and "New booking" (`/bookings/new`) all route here for owned AND
 * supplier-sourced products — they differ only by the `sourceKind`
 * provenance. The legacy `/catalog/book` single-page flow was removed; the
 * owned-only create-sheet is no longer wired into the operator route.
 */
const journeySearchSchema = z.object({
  sourceKind: z.string().min(1),
  sourceConnectionId: z.string().optional(),
  sourceRef: z.string().optional(),
  departureId: z.string().optional(),
  optionId: z.string().optional(),
  /** Stable draft id — refresh-safe. When absent, the component
   *  generates a fresh id on mount. */
  draftId: z.string().optional(),
})

export type JourneySearchParams = z.infer<typeof journeySearchSchema>

export const Route = createFileRoute("/_workspace/bookings_/journey/$entityModule/$entityId")({
  component: JourneyRouteComponent,
  validateSearch: journeySearchSchema,
})

function JourneyRouteComponent(): React.ReactElement {
  const { entityModule, entityId } = Route.useParams()
  const search = Route.useSearch()
  const draftId = useMemo(() => search.draftId ?? generateDraftId(), [search.draftId])

  return (
    <div className="container mx-auto py-6">
      <OperatorBookingJourney
        entityModule={entityModule}
        entityId={entityId}
        sourceKind={search.sourceKind}
        sourceConnectionId={search.sourceConnectionId}
        sourceRef={search.sourceRef}
        departureId={search.departureId}
        optionId={search.optionId}
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

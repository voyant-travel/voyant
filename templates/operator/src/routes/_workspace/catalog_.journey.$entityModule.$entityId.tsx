import { createFileRoute, useParams, useSearch } from "@tanstack/react-router"
import { lazy, Suspense, useMemo } from "react"
import { z } from "zod"

const OperatorBookingJourney = lazy(() =>
  import("@/components/voyant/booking-journey/operator-booking-journey").then((module) => ({
    default: module.OperatorBookingJourney,
  })),
)

/**
 * Unified booking journey route. The shareable wizard from
 * `@voyantjs/bookings-react/journey`, wrapped with operator slots
 * (CRM picker, B2B default, post-commit nav to /orders/catalog).
 *
 * Per booking-journey-architecture §10 Phase B.
 *
 * The legacy single-page booking flow at `/catalog/book/...` stays
 * available during Phase D's deprecation window — both routes hit
 * the same engine.
 */
const journeySearchSchema = z.object({
  sourceKind: z.string().min(1),
  sourceConnectionId: z.string().optional(),
  sourceRef: z.string().optional(),
  departureId: z.string().optional(),
  departureDate: z.string().optional(),
  optionId: z.string().optional(),
  roomTypeId: z.string().optional(),
  ratePlanId: z.string().optional(),
  board: z.string().optional(),
  entityName: z.string().optional(),
  entityImageUrl: z.string().optional(),
  /** Stable draft id — refresh-safe. When absent, the component
   *  generates a fresh id on mount. */
  draftId: z.string().optional(),
})

export type JourneySearchParams = z.infer<typeof journeySearchSchema>

export const Route = createFileRoute("/_workspace/catalog_/journey/$entityModule/$entityId")({
  component: JourneyRouteComponent,
  validateSearch: journeySearchSchema,
})

function JourneyRouteComponent(): React.ReactElement {
  const { entityModule, entityId } = useParams({
    from: "/_workspace/catalog_/journey/$entityModule/$entityId",
  })
  const search = useSearch({ from: "/_workspace/catalog_/journey/$entityModule/$entityId" })
  const draftId = useMemo(() => search.draftId ?? generateDraftId(), [search.draftId])

  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={null}>
        <OperatorBookingJourney
          entityModule={entityModule}
          entityId={entityId}
          sourceKind={search.sourceKind}
          sourceConnectionId={search.sourceConnectionId}
          sourceRef={search.sourceRef}
          departureId={search.departureId}
          departureDate={search.departureDate}
          optionId={search.optionId}
          roomTypeId={search.roomTypeId}
          ratePlanId={search.ratePlanId}
          board={search.board}
          entityName={search.entityName}
          entityImageUrl={search.entityImageUrl}
          draftId={draftId}
        />
      </Suspense>
    </div>
  )
}

function generateDraftId(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return `bdrf_${globalThis.crypto.randomUUID().replace(/-/g, "")}`
  }
  return `bdrf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

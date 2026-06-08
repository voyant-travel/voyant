import { createFileRoute } from "@tanstack/react-router"
import { useAdminBreadcrumbs } from "@voyantjs/admin"
import { useBookingsUiMessagesOrDefault } from "@voyantjs/bookings-ui/i18n"
import { useMemo } from "react"
import { z } from "zod"

import { OperatorBookingJourney } from "@/components/voyant/booking-journey/operator-booking-journey"
import { useAdminMessages } from "@/lib/admin-i18n"

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

  const adminMessages = useAdminMessages()
  const bookingsUiMessages = useBookingsUiMessagesOrDefault()
  useAdminBreadcrumbs([
    { label: adminMessages.bookings.list.pageTitle, href: "/bookings" },
    { label: bookingsUiMessages.bookingCreatePage.title },
  ])

  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-normal">
          {bookingsUiMessages.bookingCreatePage.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          {bookingsUiMessages.bookingCreatePage.description}
        </p>
      </header>
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
    </main>
  )
}

function generateDraftId(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return `bdrf_${globalThis.crypto.randomUUID().replace(/-/g, "")}`
  }
  return `bdrf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

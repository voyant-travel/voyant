import { createFileRoute, useLocation } from "@tanstack/react-router"
import { useAdminBreadcrumbs } from "@voyantjs/admin"
import { useBookingsUiMessagesOrDefault } from "@voyantjs/bookings-ui/i18n"
import { useMemo } from "react"
import { z } from "zod"

import { OperatorBookingJourney } from "@/components/voyant/booking-journey/operator-booking-journey"
import { useAdminMessages } from "@/lib/admin-i18n"

/**
 * THE admin booking journey. One URL — `/bookings/new/<entityId>` — for every
 * admin booking, owned or supplier-sourced; you just swap the id. The shareable
 * `@voyantjs/bookings-ui/journey` wizard, wrapped with operator slots (CRM
 * picker, B2B default, stacked layout, post-commit nav to the booking detail).
 *
 * Nothing redundant lives in the URL: the **module** defaults to `products`
 * (the vertical that carries no extra selection state); cruises/accommodations
 * pass `?module=` because they already carry their own selection params
 * (departure, cabin, dates). The **source kind/connection/ref** never appear —
 * the catalog plane resolves provenance server-side from `(module, id)` (same
 * path the storefront relies on), so an owned and a sourced product share the
 * exact same `/bookings/new/<id>` shape.
 *
 * Entry points: "New booking" picker, owned product deep-link, and the catalog
 * product/cruise/accommodation detail pages — all route here. Per
 * booking-journey-architecture §10 Phase B.
 */
const newBookingSearchSchema = z.object({
  /** Vertical. Omitted (→ `products`) for owned + sourced products. */
  module: z.string().optional(),
  /** Provenance is resolved server-side from `(module, id)`; callers normally
   *  omit these. Kept optional for any caller that already holds an explicit
   *  pointer (storefront parity — never required). */
  sourceKind: z.string().min(1).optional(),
  sourceConnectionId: z.string().optional(),
  sourceRef: z.string().optional(),
  departureId: z.string().optional(),
  /** Free-form departure date (ISO) — sourced products have no slot id, so the
   *  picked offer's check-in seeds the date directly. */
  departureDate: z.string().optional(),
  optionId: z.string().optional(),
  /** Sourced stays/package rate pin — the exact room + rate plan the operator
   *  picked, so the connect adapter re-resolves that offer (#1579). */
  roomTypeId: z.string().optional(),
  ratePlanId: z.string().optional(),
  board: z.string().optional(),
  /** Stable draft id — refresh-safe. When absent, the component
   *  generates a fresh id on mount. */
  draftId: z.string().optional(),
})

export type NewBookingSearchParams = z.infer<typeof newBookingSearchSchema>

export const Route = createFileRoute("/_workspace/bookings_/new/$entityId")({
  component: NewBookingRouteComponent,
  validateSearch: newBookingSearchSchema,
})

function NewBookingRouteComponent(): React.ReactElement {
  const { entityId } = Route.useParams()
  const search = Route.useSearch()
  // Preview hints (name + hero image) ride in ephemeral history state, not the
  // URL — they're a nicety for the side panel, not addressable state.
  const { entityName, entityImageUrl } = useLocation({ select: (l) => l.state })
  const entityModule = search.module ?? "products"
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
        departureDate={search.departureDate}
        optionId={search.optionId}
        roomTypeId={search.roomTypeId}
        ratePlanId={search.ratePlanId}
        board={search.board}
        entityName={entityName}
        entityImageUrl={entityImageUrl}
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

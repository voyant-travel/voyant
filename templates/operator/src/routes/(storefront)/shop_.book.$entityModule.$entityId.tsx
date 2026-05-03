import { createFileRoute, useParams, useSearch } from "@tanstack/react-router"
import { useMemo } from "react"
import { z } from "zod"

import { StorefrontBookingJourney } from "@/components/voyant/booking-journey/storefront-booking-journey"

/**
 * Storefront booking-journey route. The customer arrives here from
 * the product / cruise / hospitality detail page with **the
 * relevant configure inputs already locked in** via search params.
 * The journey itself only handles travelers + add-ons + payment;
 * the Configure step is hidden because Configure already happened
 * upstream.
 *
 * Per booking-journey-architecture §10 Phase B.
 *
 * **No `sourceKind` in the URL.** The public engine route resolves
 * provenance from `(entityModule, entityId)` server-side.
 */
const shopBookSearchSchema = z.object({
  /** Schedule pointer — exactly the right subset per vertical:
   *   - products → `departureSlotId`
   *   - cruises  → `departureSlotId` (sailing id) +
   *               `cabinCategoryId`, optionally `cabinNumberId` +
   *               `airArrangement`
   *   - hospitality → `checkIn` + `checkOut` + `roomTypeId` +
   *               `ratePlanId`
   * The detail page fills the right subset before navigating.
   */
  departureSlotId: z.string().optional(),
  cabinCategoryId: z.string().optional(),
  cabinNumberId: z.string().optional(),
  airArrangement: z.enum(["cruise_line", "independent", "none"]).optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  roomTypeId: z.string().optional(),
  ratePlanId: z.string().optional(),
  /** Pax counts per band. Adults default to 1 if absent so the
   *  validation passes; children + infants default to 0. */
  adult: z.coerce.number().int().min(0).optional(),
  child: z.coerce.number().int().min(0).optional(),
  infant: z.coerce.number().int().min(0).optional(),
  draftId: z.string().optional(),
})

export const Route = createFileRoute("/(storefront)/shop_/book/$entityModule/$entityId")({
  component: ShopBookRouteComponent,
  validateSearch: shopBookSearchSchema,
})

function ShopBookRouteComponent(): React.ReactElement {
  const { entityModule, entityId } = useParams({
    from: "/(storefront)/shop_/book/$entityModule/$entityId",
  })
  const search = useSearch({ from: "/(storefront)/shop_/book/$entityModule/$entityId" })
  const draftId = useMemo(() => search.draftId ?? generateDraftId(), [search.draftId])

  const initialConfigure: Record<string, unknown> = {
    pax: {
      adult: search.adult ?? 1,
      child: search.child ?? 0,
      infant: search.infant ?? 0,
    },
  }
  if (search.departureSlotId) initialConfigure.departureSlotId = search.departureSlotId
  if (search.cabinCategoryId) initialConfigure.cabinCategoryId = search.cabinCategoryId
  if (search.cabinNumberId) initialConfigure.cabinNumberId = search.cabinNumberId
  if (search.airArrangement) initialConfigure.airArrangement = search.airArrangement
  if (search.checkIn && search.checkOut) {
    initialConfigure.dateRange = { checkIn: search.checkIn, checkOut: search.checkOut }
  }

  const initialAccommodation = search.roomTypeId
    ? {
        rooms: [
          {
            optionUnitId: search.roomTypeId,
            quantity: 1,
            ...(search.ratePlanId ? { ratePlanId: search.ratePlanId } : {}),
          },
        ],
        travelerAssignments: {},
      }
    : undefined

  return (
    <StorefrontBookingJourney
      entityModule={entityModule}
      entityId={entityId}
      draftId={draftId}
      initialConfigure={initialConfigure}
      initialAccommodation={initialAccommodation}
    />
  )
}

function generateDraftId(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return `bdrf_${globalThis.crypto.randomUUID().replace(/-/g, ``)}`
  }
  return `bdrf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

import { createFileRoute, useParams, useSearch } from "@tanstack/react-router"
import { useMemo } from "react"
import { z } from "zod"

import { StorefrontBookingJourney } from "@/components/voyant/booking-journey/storefront-booking-journey"

/**
 * Storefront booking-journey route. The customer arrives here from
 * the product detail page with **departure + pax already
 * locked in** via search params — that's the protravel / luxufe
 * pattern. The journey itself only handles travelers + add-ons +
 * payment; the Configure step is hidden because Configure already
 * happened upstream.
 *
 * Per booking-journey-architecture §10 Phase B + the production
 * reference engines.
 *
 * **No `sourceKind` in the URL.** The public engine route resolves
 * provenance from `(entityModule, entityId)` server-side.
 */
const shopBookSearchSchema = z.object({
  /** Required — departure picked on the detail page. */
  departureSlotId: z.string().min(1),
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

  return (
    <StorefrontBookingJourney
      entityModule={entityModule}
      entityId={entityId}
      draftId={draftId}
      departureSlotId={search.departureSlotId}
      paxCounts={{
        adult: search.adult ?? 1,
        child: search.child ?? 0,
        infant: search.infant ?? 0,
      }}
    />
  )
}

function generateDraftId(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return `bdrf_${globalThis.crypto.randomUUID().replace(/-/g, ``)}`
  }
  return `bdrf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

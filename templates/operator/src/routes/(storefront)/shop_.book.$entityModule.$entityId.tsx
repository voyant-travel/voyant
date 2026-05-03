import { createFileRoute, useParams, useSearch } from "@tanstack/react-router"
import { useMemo } from "react"
import { z } from "zod"

import { StorefrontBookingJourney } from "@/components/voyant/booking-journey/storefront-booking-journey"

/**
 * Storefront booking-journey route — same shell + hooks as the
 * operator's `/_workspace/catalog/journey/...` route, just wrapped
 * with `<StorefrontBookingJourney />` (surface=public, B2C
 * default, post-commit nav to /shop/confirmation/$bookingId).
 *
 * Per booking-journey-architecture §10 Phase B.
 *
 * **No `sourceKind` in the URL.** The public engine route resolves
 * provenance from `(entityModule, entityId)` server-side via the
 * catalog plane's sourced-entry lookup. Customers shouldn't have
 * to know whether a row is owned vs sourced from a supplier — that's
 * an operator concern.
 */
const shopBookSearchSchema = z.object({
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
    <StorefrontBookingJourney entityModule={entityModule} entityId={entityId} draftId={draftId} />
  )
}

function generateDraftId(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return `bdrf_${globalThis.crypto.randomUUID().replace(/-/g, ``)}`
  }
  return `bdrf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

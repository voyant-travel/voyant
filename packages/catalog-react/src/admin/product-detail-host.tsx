"use client"

import {
  useAdminBreadcrumbs,
  useAdminHref,
  useAdminNavigate,
  useOperatorAdminMessages,
} from "@voyant-travel/admin"
import { useState } from "react"

import { ProductDetailPage } from "../components/product-detail-page.js"

export interface ProductDetailHostProps {
  productId: string
  adults?: number
  nights?: number
  locale?: string
}

/**
 * Packaged admin host for `ProductDetailPage` — injects the localized
 * "Packages" label, navigation to the booking journey (pinned to the resolved
 * source when available), and breadcrumbs.
 *
 * Proof-of-contract for semantic destinations (packaged-admin RFC §4.7): no
 * host route tree is imported — the `catalog.browse` / `bookingJourney.start`
 * keys declared in `./index.tsx` resolve through the resolvers the workspace
 * shell registered.
 */
export function ProductDetailHost({ productId, adults, nights, locale }: ProductDetailHostProps) {
  const resolveHref = useAdminHref()
  const navigateTo = useAdminNavigate()
  const productsLabel = useOperatorAdminMessages().nav.catalogProducts
  const productsHref = resolveHref("catalog.browse", { surface: "products" })
  const [crumbs, setCrumbs] = useState<Array<{ label: string; href?: string }>>([
    { label: productsLabel, href: productsHref },
  ])
  useAdminBreadcrumbs(crumbs)

  return (
    <ProductDetailPage
      productId={productId}
      adults={adults}
      nights={nights}
      locale={locale}
      productsLabel={productsLabel}
      productsHref={productsHref}
      onBreadcrumbs={setCrumbs}
      // Product detail → the unified journey. Preserve the resolved source
      // pointer when available; otherwise the journey APIs resolve provenance
      // server-side from (entityModule, entityId).
      onBook={(id, source, selection) => {
        const sourceKind = source.kind?.trim()
        return navigateTo("bookingJourney.start", {
          entityModule: "products",
          entityId: id,
          ...(sourceKind ? { sourceKind } : {}),
          ...(source.connectionId ? { sourceConnectionId: source.connectionId } : {}),
          ...(source.ref ? { sourceRef: source.ref } : {}),
          ...(selection?.checkIn ? { departureDate: selection.checkIn.slice(0, 10) } : {}),
          ...(selection?.roomTypeId ? { roomTypeId: selection.roomTypeId } : {}),
          ...(selection?.ratePlanId ? { ratePlanId: selection.ratePlanId } : {}),
          ...(selection?.board ? { board: selection.board } : {}),
          ...(selection?.name ? { entityName: selection.name } : {}),
          ...(selection?.heroImageUrl ? { entityImageUrl: selection.heroImageUrl } : {}),
        })
      }}
    />
  )
}

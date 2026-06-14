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
 * Connect source), and breadcrumbs.
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
      // Connect-sourced product → the unified journey. The picked offer's date
      // + rate pin (room + rate plan) drive the quote so the adapter re-resolves
      // the exact offer; name/image preview the side panel.
      onBook={(id, _source, selection) =>
        navigateTo("bookingJourney.start", {
          entityModule: "products",
          entityId: id,
          sourceKind: "voyant-connect",
          ...(selection?.checkIn ? { departureDate: selection.checkIn.slice(0, 10) } : {}),
          ...(selection?.roomTypeId ? { roomTypeId: selection.roomTypeId } : {}),
          ...(selection?.ratePlanId ? { ratePlanId: selection.ratePlanId } : {}),
          ...(selection?.board ? { board: selection.board } : {}),
          ...(selection?.name ? { entityName: selection.name } : {}),
          ...(selection?.heroImageUrl ? { entityImageUrl: selection.heroImageUrl } : {}),
        })
      }
    />
  )
}

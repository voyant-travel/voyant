"use client"

import { useNavigate } from "@tanstack/react-router"
import { useAdminBreadcrumbs } from "@voyantjs/admin"
import { ProductDetailPage } from "@voyantjs/catalog-ui"
import { useState } from "react"

import { useAdminMessages } from "@/lib/admin-i18n"

/**
 * Operator host for the packaged `ProductDetailPage` — injects the localized
 * "Packages" label, router navigation to the booking journey (pinned to the
 * resolved Connect source), and breadcrumbs.
 */
export function OperatorProductDetail({
  productId,
  adults,
  nights,
  locale,
}: {
  productId: string
  adults?: number
  nights?: number
  locale?: string
}) {
  const navigate = useNavigate()
  const productsLabel = useAdminMessages().nav.catalogProducts
  const [crumbs, setCrumbs] = useState<Array<{ label: string; href?: string }>>([
    { label: productsLabel, href: "/catalog/products" },
  ])
  useAdminBreadcrumbs(crumbs)

  return (
    <ProductDetailPage
      productId={productId}
      adults={adults}
      nights={nights}
      locale={locale}
      productsLabel={productsLabel}
      productsHref="/catalog/products"
      onBreadcrumbs={setCrumbs}
      // Connect-sourced product → the unified journey. The picked offer's date
      // + rate pin (room + rate plan) drive the quote so the adapter re-resolves
      // the exact offer; name/image preview the side panel.
      onBook={(id, _source, selection) =>
        void navigate({
          to: "/catalog/journey/$entityModule/$entityId",
          params: { entityModule: "products", entityId: id },
          search: {
            sourceKind: "voyant-connect",
            ...(selection?.checkIn ? { departureDate: selection.checkIn.slice(0, 10) } : {}),
            ...(selection?.roomTypeId ? { roomTypeId: selection.roomTypeId } : {}),
            ...(selection?.ratePlanId ? { ratePlanId: selection.ratePlanId } : {}),
            ...(selection?.board ? { board: selection.board } : {}),
            ...(selection?.name ? { entityName: selection.name } : {}),
            ...(selection?.heroImageUrl ? { entityImageUrl: selection.heroImageUrl } : {}),
          },
        })
      }
    />
  )
}

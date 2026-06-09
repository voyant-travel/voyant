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
      // Products vertical: clean `/bookings/new/<id>`. Provenance (owned vs
      // connect, connection, ref) resolves server-side from (products, id).
      onBook={(id) => void navigate({ to: "/bookings/new/$entityId", params: { entityId: id } })}
    />
  )
}

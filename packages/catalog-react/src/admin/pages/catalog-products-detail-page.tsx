"use client"

import type { AdminRoutePageProps } from "@voyant-travel/admin"

import type { ProductDetailSearchParams } from "../index.js"
import { ProductDetailHost } from "../product-detail-host.js"

/**
 * Packaged route page for the product (package) detail surface. The
 * contribution's `validateSearch` (productDetailSearchSchema) already
 * validated `search`, so the cast onto the package search contract is sound.
 */
export default function CatalogProductsDetailPage({ params, search }: AdminRoutePageProps) {
  const { adults, nights, locale } = search as ProductDetailSearchParams

  return (
    <ProductDetailHost
      productId={params.productId ?? ""}
      adults={adults}
      nights={nights}
      locale={locale}
    />
  )
}

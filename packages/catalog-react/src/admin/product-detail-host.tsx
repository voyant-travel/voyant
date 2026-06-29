"use client"

import { VerticalDetailHost } from "./vertical-detail-host.js"

export interface ProductDetailHostProps {
  productId: string
  adults?: number
  nights?: number
  locale?: string
}

/**
 * Generic package/product detail host. `/catalog/products/:id` is a catalog
 * product route, so it uses the same sourced content and booking path as the
 * tour/excursion detail pages instead of the Connect package-offer endpoint.
 *
 * `adults`/`nights` remain on the public props for URL/search-param
 * compatibility with older package-offer links. Generic sourced product detail
 * resolves availability through catalog slots instead.
 */
export function ProductDetailHost({ productId, locale }: ProductDetailHostProps) {
  return <VerticalDetailHost surface="products" id={productId} locale={locale} />
}

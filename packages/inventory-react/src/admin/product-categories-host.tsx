"use client"

import { ProductCategoriesPage } from "../components/product-categories-page.js"

/**
 * Packaged admin host for `ProductCategoriesPage` (packaged-admin RFC
 * Phase 3). The page keeps its dialog/paging state locally and links
 * nowhere, so the host is a zero-prop mount.
 */
export function ProductCategoriesHost() {
  return <ProductCategoriesPage />
}

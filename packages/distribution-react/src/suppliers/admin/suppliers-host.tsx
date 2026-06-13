"use client"

import { useAdminNavigate } from "@voyantjs/admin"

import { SuppliersPage } from "../components/suppliers-page.js"

/**
 * Packaged admin host for `SuppliersPage` (packaged-admin RFC Phase 3).
 *
 * No host route tree is imported — opening a supplier resolves the
 * `"supplier.detail"` semantic destination (RFC §4.7) through the resolvers
 * the workspace shell registered. The page keeps its filter/sort/paging
 * state locally (no URL search contract), so the host takes no props and
 * route files can attach it as a zero-prop `component:` directly.
 */
export function SuppliersHost() {
  const navigateTo = useAdminNavigate()

  return (
    <SuppliersPage
      onSupplierOpen={(supplier) => navigateTo("supplier.detail", { supplierId: supplier.id })}
    />
  )
}

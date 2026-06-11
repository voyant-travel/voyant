"use client"

import { ProductPickerSection, type ProductPickerValue } from "@voyantjs/bookings-react/ui"

/**
 * Product picker for "New booking". Picks owned products straight off the
 * products table — real names (including non-English), always browsable, with
 * a proper loading state — and the host routes the selection into the unified
 * booking journey. Supplier-sourced products are booked from the catalog
 * browse/detail pages (which carry the connect provenance), not here.
 */
export interface CatalogProductPickerProps {
  value: ProductPickerValue
  onChange: (value: ProductPickerValue) => void
  enabled?: boolean
  lockProduct?: boolean
}

export function CatalogProductPicker({
  value,
  onChange,
  enabled,
  lockProduct,
}: CatalogProductPickerProps) {
  return (
    <ProductPickerSection
      value={value}
      onChange={onChange}
      enabled={enabled}
      lockProduct={lockProduct}
      showOptionPicker={false}
    />
  )
}

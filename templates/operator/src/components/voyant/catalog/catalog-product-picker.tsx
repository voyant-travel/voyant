"use client"

import { type ProductPickerRenderProps, ProductPickerSection } from "@voyantjs/bookings-ui"

/**
 * Product picker for "New booking". Picks owned products straight off the
 * products table — real names (including non-English), always browsable, with
 * proper loading state — and routes the selection into the booking journey.
 *
 * It satisfies `ProductPickerRenderProps` so it can also drop into the
 * create-sheet's `renderProductPicker` slot. Supplier-sourced products (catalog
 * search index) aren't surfaced here yet: that index stores translated en-GB
 * names + a cached catalog price the operator's own products don't carry, so it
 * isn't the right surface for picking owned products. `onSourcedSelected`
 * stays on the props for when the sourced path returns.
 */

export interface SourcedProductSelection {
  entityModule: string
  entityId: string
  sourceKind: string
  sourceRef?: string
  sourceConnectionId?: string
  name?: string
}

export interface CatalogProductPickerProps extends ProductPickerRenderProps {
  /** A supplier-sourced product was picked — host hands off to the booking journey. */
  onSourcedSelected: (selection: SourcedProductSelection) => void
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

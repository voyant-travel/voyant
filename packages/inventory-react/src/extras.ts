/**
 * Inventory React extras facade for operated add-on authoring.
 *
 * The implementation delegates to the legacy extras React package during the
 * facade-first migration. Import new authoring UI from this subpath.
 */

export type {
  CreateProductExtraInput,
  ProductExtraRecord,
  ProductExtrasListFilters,
  UpdateProductExtraInput,
  UseProductExtrasOptions,
} from "@voyantjs/extras-react"
export {
  defaultFetcher,
  fetchWithValidation,
  getProductExtraQueryOptions,
  getProductExtrasQueryOptions,
  useProductExtra,
  useProductExtraMutation,
  useProductExtras,
  useVoyantExtrasContext as useVoyantInventoryExtrasContext,
  VoyantApiError,
  type VoyantExtrasContextValue as VoyantInventoryExtrasContextValue,
  VoyantExtrasProvider as VoyantInventoryExtrasProvider,
  type VoyantExtrasProviderProps as VoyantInventoryExtrasProviderProps,
  type VoyantFetcher,
} from "@voyantjs/extras-react"
export { ProductCombobox } from "@voyantjs/extras-react/ui"

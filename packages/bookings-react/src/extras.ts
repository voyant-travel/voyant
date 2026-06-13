/**
 * Bookings React extras facade for booking-time add-on selection and slot
 * manifests.
 */

export type {
  ProductExtraRecord,
  ProductExtrasListFilters,
  SlotExtraCollectionBulkInput,
  SlotExtraManifest,
  SlotExtraManifestSelection,
  SlotExtraManifestTraveler,
  SlotExtraSelectionBulkInput,
  SlotExtraSelectionPatchInput,
  UseProductExtrasOptions,
} from "@voyantjs/extras-react"
export {
  defaultFetcher,
  extrasQueryKeys as bookingsExtrasQueryKeys,
  fetchWithValidation,
  getProductExtrasQueryOptions,
  getSlotExtraManifestQueryOptions,
  useProductExtras,
  useSlotExtraManifest,
  useSlotExtraManifestMutation,
  useVoyantExtrasContext as useVoyantBookingsExtrasContext,
  VoyantApiError,
  type VoyantExtrasContextValue as VoyantBookingsExtrasContextValue,
  VoyantExtrasProvider as VoyantBookingsExtrasProvider,
  type VoyantExtrasProviderProps as VoyantBookingsExtrasProviderProps,
  type VoyantFetcher,
} from "@voyantjs/extras-react"
export {
  type ExtrasUiMessageOverrides,
  type ExtrasUiMessages,
  ExtrasUiMessagesProvider,
  extrasUiEn,
  extrasUiMessageDefinitions,
  extrasUiRo,
  getExtrasUiI18n,
  resolveExtrasUiMessages,
  SlotExtrasManifestPanel,
  useExtrasUiI18n,
  useExtrasUiI18nOrDefault,
  useExtrasUiMessages,
  useExtrasUiMessagesOrDefault,
} from "@voyantjs/extras-react/ui"

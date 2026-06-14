import type { Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import { extrasRoutes } from "./routes.js"
import { extrasService } from "./service.js"

export type { ExtrasRoutes } from "./routes.js"

export const extrasModule: Module = {
  name: "extras",
}

export const extrasHonoModule: HonoModule = {
  module: extrasModule,
  routes: extrasRoutes,
}

export type {
  BookingExtra,
  ExtraParticipantSelection,
  NewBookingExtra,
  NewExtraParticipantSelection,
  NewOptionExtraConfig,
  NewProductExtra,
  OptionExtraConfig,
  ProductExtra,
} from "./schema.js"
export {
  bookingExtraStatusEnum,
  bookingExtras,
  bookingExtrasRelations,
  extraCollectionModeEnum,
  extraCollectionStatusEnum,
  extraParticipantSelectionStatusEnum,
  extraParticipantSelections,
  extraParticipantSelectionsRelations,
  extraPricingModeEnum,
  extraSelectionTypeEnum,
  extrasSourcedContentTable,
  optionExtraConfigs,
  optionExtraConfigsRelations,
  productExtras,
  productExtrasRelations,
} from "./schema.js"
export {
  bookingExtraCoreSchema,
  bookingExtraListQuerySchema,
  bookingExtraStatusSchema,
  extraCollectionModeSchema,
  extraCollectionStatusSchema,
  extraParticipantSelectionStatusSchema,
  extraPricingModeSchema,
  extraSelectionTypeSchema,
  insertBookingExtraSchema,
  insertOptionExtraConfigSchema,
  insertProductExtraSchema,
  optionExtraConfigCoreSchema,
  optionExtraConfigListQuerySchema,
  productExtraCoreSchema,
  productExtraListQuerySchema,
  slotExtraCollectionBulkSchema,
  slotExtraManifestQuerySchema,
  slotExtraSelectionBulkSchema,
  slotExtraSelectionPatchSchema,
  updateBookingExtraSchema,
  updateOptionExtraConfigSchema,
  updateProductExtraSchema,
} from "./validation.js"
export { extrasService }

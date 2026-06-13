/**
 * Inventory-owned extras facade.
 *
 * The current extras tables still live in the legacy package during the v1
 * migration because authoring rows and booking-selection rows share an FK
 * graph. This subpath is the supported Inventory target for operated add-on
 * authoring/configuration while the physical schema split is deferred.
 */

import { extrasService } from "@voyantjs/extras"

export { extrasCatalogPolicy } from "@voyantjs/extras/catalog-policy"
export {
  EXTRAS_CONTENT_SCHEMA_VERSION,
  type ExtraContent,
  type ExtraMediaItem,
  type ExtraOption,
  type ExtraPolicy,
  type ExtraSummary,
  extraContentSchema,
  extraMediaItemSchema,
  extraOptionSchema,
  extraPolicySchema,
  extraSummarySchema,
  mergeOverlaysIntoExtraContent,
  validateExtraContent,
} from "@voyantjs/extras/content-shape"
export {
  type BuildExtraDraftShapeOptions,
  buildExtraDraftShape,
} from "@voyantjs/extras/draft-shape"
export type {
  NewOptionExtraConfig,
  NewProductExtra,
  OptionExtraConfig,
  ProductExtra,
} from "@voyantjs/extras/schema"
export {
  EXTRAS_CONTENT_MARKET_ANY,
  extraCollectionModeEnum,
  extraPricingModeEnum,
  extraSelectionTypeEnum,
  extrasSourcedContentTable,
  type InsertExtrasSourcedContent,
  optionExtraConfigs,
  optionExtraConfigsRelations,
  productExtras,
  productExtrasRelations,
  type SelectExtrasSourcedContent,
} from "@voyantjs/extras/schema"
export {
  buildExtraSnapshotInput,
  type CaptureSnapshotInput,
  createExtraDocumentBuilder,
  createExtraDocumentEmitter,
  type DocumentBuilder,
  type DocumentEmitter,
  getResolvedExtraById,
  type IndexerDocument,
  type IndexerSlice,
  listResolvedExtras,
  type PricingBasis,
  type ProductExtraCatalogContext,
  type Provenance,
  productExtraProvenance,
  productExtraRowToProjection,
  type ResolvedView,
  type ResolverScope,
} from "@voyantjs/extras/service-catalog-plane"
export {
  type ExtraContentScope,
  type GetExtraContentOptions,
  getExtraContent,
  type ResolvedExtraContent,
} from "@voyantjs/extras/service-content"
export {
  type SynthesizedExtraContent,
  type SynthesizeExtraContentOptions,
  synthesizeExtraContent,
  synthesizeExtraContentFromDb,
} from "@voyantjs/extras/service-content-synthesizer"
export {
  extraCollectionModeSchema,
  extraPricingModeSchema,
  extraSelectionTypeSchema,
  insertOptionExtraConfigSchema,
  insertProductExtraSchema,
  optionExtraConfigCoreSchema,
  optionExtraConfigListQuerySchema,
  productExtraCoreSchema,
  productExtraListQuerySchema,
  updateOptionExtraConfigSchema,
  updateProductExtraSchema,
} from "@voyantjs/extras/validation"

export const inventoryExtrasService = {
  listProductExtras: extrasService.listProductExtras,
  getProductExtraById: extrasService.getProductExtraById,
  createProductExtra: extrasService.createProductExtra,
  updateProductExtra: extrasService.updateProductExtra,
  deleteProductExtra: extrasService.deleteProductExtra,
  listOptionExtraConfigs: extrasService.listOptionExtraConfigs,
  getOptionExtraConfigById: extrasService.getOptionExtraConfigById,
  createOptionExtraConfig: extrasService.createOptionExtraConfig,
  updateOptionExtraConfig: extrasService.updateOptionExtraConfig,
  deleteOptionExtraConfig: extrasService.deleteOptionExtraConfig,
}

export const operatedExtrasService = inventoryExtrasService

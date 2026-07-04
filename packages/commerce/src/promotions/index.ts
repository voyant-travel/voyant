import type { HonoModule } from "@voyant-travel/hono/module"

import { promotionsModule } from "./module-metadata.js"
import { createPromotionsRoutes, type PromotionsRoutesOptions, promotionsRoutes } from "./routes.js"

export { promotionsModule } from "./module-metadata.js"
export type { PromotionsRoutes, PromotionsRoutesOptions } from "./routes.js"

export const promotionsHonoModule: HonoModule = {
  module: promotionsModule,
  adminRoutes: promotionsRoutes,
}

export function createPromotionsHonoModule(options?: PromotionsRoutesOptions): HonoModule {
  return {
    module: promotionsModule,
    adminRoutes: createPromotionsRoutes(options),
  }
}

export {
  PROMOTION_CHANGED_EVENT,
  type PromotionChangedAffected,
  type PromotionChangedEvent,
  type PromotionChangedSource,
} from "./events.js"

export {
  type NewPromotionalOffer,
  type NewPromotionalOfferProduct,
  type NewPromotionalOfferRedemption,
  type PromotionalOffer,
  type PromotionalOfferDiscountType,
  type PromotionalOfferProduct,
  type PromotionalOfferRedemption,
  promotionalOfferDiscountTypeEnum,
  promotionalOfferProducts,
  promotionalOfferRedemptions,
  promotionalOffers,
} from "./schema.js"
export {
  type OfferMutationRuntime,
  type PromotionsService,
  promotionsService,
  type ResolveExistingPromotionalOfferProductIds,
  recomputeOfferLinks,
  resolveScopeProductIds,
} from "./service.js"
export {
  type InsertPromotionalOffer,
  type InsertPromotionalOfferInput,
  insertPromotionalOfferSchema,
  type PromotionalOfferApplicationMode,
  type PromotionalOfferConditions,
  type PromotionalOfferListQuery,
  type PromotionalOfferListStatus,
  type PromotionalOfferScope,
  type PromotionalOfferScopeKind,
  promotionalOfferConditionsSchema,
  promotionalOfferListQuerySchema,
  promotionalOfferScopeSchema,
  type UpdatePromotionalOffer,
  type UpdatePromotionalOfferInput,
  updatePromotionalOfferSchema,
} from "./validation.js"
export {
  type BulkReindexProductsInput,
  type BulkReindexProductsOutput,
  bulkReindexProductsWorkflow,
  promotionAffectedAllFilter,
} from "./workflow-bulk-reindex.js"
export {
  BULK_REINDEX_SERVICE_KEY,
  type BulkReindexProductsService,
} from "./workflow-runtime.js"

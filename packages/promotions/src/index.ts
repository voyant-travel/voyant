import type { Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import { promotionsRoutes } from "./routes.js"

export type { PromotionsRoutes } from "./routes.js"

export const promotionsModule: Module = {
  name: "promotions",
}

export const promotionsHonoModule: HonoModule = {
  module: promotionsModule,
  adminRoutes: promotionsRoutes,
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
  recomputeOfferLinks,
  resolveScopeProductIds,
} from "./service.js"
export {
  type InsertPromotionalOffer,
  type InsertPromotionalOfferInput,
  insertPromotionalOfferSchema,
  type PromotionalOfferConditions,
  type PromotionalOfferListQuery,
  type PromotionalOfferScope,
  type PromotionalOfferScopeKind,
  promotionalOfferConditionsSchema,
  promotionalOfferListQuerySchema,
  promotionalOfferScopeSchema,
  type UpdatePromotionalOffer,
  type UpdatePromotionalOfferInput,
  updatePromotionalOfferSchema,
} from "./validation.js"

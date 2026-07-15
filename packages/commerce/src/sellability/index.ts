import type { Module } from "@voyant-travel/core"
import type { ApiModule } from "@voyant-travel/hono/module"

import {
  createSellabilityRoutes,
  type SellabilityRoutesOptions,
  sellabilityRoutes,
} from "./routes.js"

export type { SellabilityRoutes, SellabilityRoutesOptions } from "./routes.js"

export const sellabilityModule: Module = {
  name: "sellability",
}

export const sellabilityApiModule: ApiModule = {
  module: sellabilityModule,
  adminRoutes: sellabilityRoutes,
}

export function createSellabilityApiModule(options?: SellabilityRoutesOptions): ApiModule {
  const routes = createSellabilityRoutes(options)
  return {
    module: sellabilityModule,
    adminRoutes: routes,
  }
}

export type {
  NewOfferExpirationEvent,
  NewOfferRefreshRun,
  NewSellabilityExplanation,
  NewSellabilityPolicy,
  NewSellabilityPolicyResult,
  NewSellabilitySnapshot,
  NewSellabilitySnapshotItem,
  OfferExpirationEvent,
  OfferRefreshRun,
  SellabilityExplanation,
  SellabilityPolicy,
  SellabilityPolicyResult,
  SellabilitySnapshot,
  SellabilitySnapshotItem,
} from "./schema.js"
export {
  offerExpirationEventStatusEnum,
  offerExpirationEvents,
  offerRefreshRunStatusEnum,
  offerRefreshRuns,
  sellabilityExplanations,
  sellabilityExplanationTypeEnum,
  sellabilityPolicies,
  sellabilityPolicyResultStatusEnum,
  sellabilityPolicyResults,
  sellabilityPolicyScopeEnum,
  sellabilityPolicyTypeEnum,
  sellabilitySnapshotComponentKindEnum,
  sellabilitySnapshotItems,
  sellabilitySnapshotStatusEnum,
  sellabilitySnapshots,
} from "./schema.js"
export type { SellabilityServiceOptions } from "./service.js"
export { createSellabilityService, sellabilityService } from "./service.js"
export {
  insertOfferExpirationEventSchema,
  insertOfferRefreshRunSchema,
  insertSellabilityExplanationSchema,
  insertSellabilityPolicyResultSchema,
  insertSellabilityPolicySchema,
  offerExpirationEventListQuerySchema,
  offerExpirationEventStatusSchema,
  offerRefreshRunListQuerySchema,
  offerRefreshRunStatusSchema,
  sellabilityExplanationListQuerySchema,
  sellabilityExplanationTypeSchema,
  sellabilityPersistSnapshotSchema,
  sellabilityPolicyListQuerySchema,
  sellabilityPolicyResultListQuerySchema,
  sellabilityPolicyResultStatusSchema,
  sellabilityPolicyScopeSchema,
  sellabilityPolicyTypeSchema,
  sellabilityResolveQuerySchema,
  sellabilitySnapshotItemListQuerySchema,
  sellabilitySnapshotListQuerySchema,
  sellabilitySnapshotStatusSchema,
  updateOfferExpirationEventSchema,
  updateOfferRefreshRunSchema,
  updateSellabilityExplanationSchema,
  updateSellabilityPolicyResultSchema,
  updateSellabilityPolicySchema,
} from "./validation.js"

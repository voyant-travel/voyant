import type { HonoModule } from "@voyant-travel/hono/module"
import { marketsHonoModule } from "./markets/index.js"
import { pricingHonoModule } from "./pricing/index.js"
import {
  createPromotionsHonoModule,
  type PromotionsRoutesOptions,
  promotionsHonoModule,
} from "./promotions/index.js"
import { createPromotionsStorefrontResolvers } from "./promotions/service-storefront.js"
import {
  createSellabilityHonoModule,
  type SellabilityRoutesOptions,
  sellabilityHonoModule,
} from "./sellability/index.js"

export const commerceRuntimeModuleNames = [
  "pricing",
  "markets",
  "sellability",
  "promotions",
] as const

export type CommerceRuntimeModuleName = (typeof commerceRuntimeModuleNames)[number]

export interface CommerceHonoModulesOptions {
  promotions?: PromotionsRoutesOptions
  sellability?: SellabilityRoutesOptions
}

/**
 * Runtime consolidation for the Commerce Module.
 *
 * This keeps existing API route prefixes stable while allowing templates to
 * declare one Commerce manifest entry. The old packages remain schema owners
 * until explicit schema-move issues migrate their tables.
 */
export function createCommerceHonoModules(options: CommerceHonoModulesOptions = {}): HonoModule[] {
  return [
    pricingHonoModule,
    marketsHonoModule,
    options.sellability ? createSellabilityHonoModule(options.sellability) : sellabilityHonoModule,
    options.promotions ? createPromotionsHonoModule(options.promotions) : promotionsHonoModule,
  ]
}

export const createCommerceStorefrontOfferResolvers = createPromotionsStorefrontResolvers

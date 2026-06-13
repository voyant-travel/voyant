import type { HonoModule } from "@voyantjs/hono/module"
import { marketsHonoModule } from "@voyantjs/markets"
import { pricingHonoModule } from "@voyantjs/pricing"
import { promotionsHonoModule } from "@voyantjs/promotions"
import { createPromotionsStorefrontResolvers } from "@voyantjs/promotions/service-storefront"
import { sellabilityHonoModule } from "@voyantjs/sellability"

export const commerceRuntimeModuleNames = [
  "pricing",
  "markets",
  "sellability",
  "promotions",
] as const

export type CommerceRuntimeModuleName = (typeof commerceRuntimeModuleNames)[number]

/**
 * Runtime consolidation for the Commerce Module.
 *
 * This keeps existing API route prefixes stable while allowing templates to
 * declare one Commerce manifest entry. The old packages remain schema owners
 * until explicit schema-move issues migrate their tables.
 */
export function createCommerceHonoModules(): HonoModule[] {
  return [pricingHonoModule, marketsHonoModule, sellabilityHonoModule, promotionsHonoModule]
}

export const createCommerceStorefrontOfferResolvers = createPromotionsStorefrontResolvers

import { isGraphRuntimeFactory } from "@voyant-travel/core/project"
import { describe, expect, it } from "vitest"
import {
  createBookingMaintenanceHonoExtension,
  createCatalogCheckoutGraphExtension,
  createCatalogCheckoutHonoExtension,
} from "./checkout/index.js"
import {
  commerceRuntimeModuleNames,
  createCommerceHonoModules,
  createCommerceStorefrontOfferResolvers,
} from "./index.js"
import { marketsHonoModule } from "./markets/index.js"
import { pricingHonoModule } from "./pricing/index.js"
import { promotionsHonoModule } from "./promotions/index.js"
import { sellabilityHonoModule } from "./sellability/index.js"

describe("commerce runtime", () => {
  it("publishes checkout and booking maintenance extension descriptors", () => {
    const checkout = createCatalogCheckoutHonoExtension({} as never)
    const maintenance = createBookingMaintenanceHonoExtension({} as never)

    expect(checkout.extension).toEqual({ name: "catalog-checkout", module: "catalog" })
    expect(checkout.publicRoutes).toBeDefined()
    expect(isGraphRuntimeFactory(createCatalogCheckoutGraphExtension)).toBe(true)
    expect(maintenance.extension).toEqual({ name: "booking-maintenance", module: "bookings" })
    expect(maintenance.adminRoutes).toBeDefined()
  })

  it("expands to the commercial runtime modules in stable order", () => {
    const modules = createCommerceHonoModules()

    expect(modules.map((mod) => mod.module.name)).toEqual([...commerceRuntimeModuleNames])
    expect(modules).toEqual([
      pricingHonoModule,
      marketsHonoModule,
      sellabilityHonoModule,
      promotionsHonoModule,
    ])
  })

  it("exports a Commerce-named storefront offer resolver factory", () => {
    const resolvers = createCommerceStorefrontOfferResolvers()

    expect(typeof resolvers.listApplicableOffers).toBe("function")
    expect(typeof resolvers.getOfferBySlug).toBe("function")
    expect(typeof resolvers.applyOffer).toBe("function")
    expect(typeof resolvers.redeemOffer).toBe("function")
  })
})

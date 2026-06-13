import { describe, expect, it } from "vitest"

import {
  commerceRuntimeModuleNames,
  createCommerceHonoModules,
  createCommerceStorefrontOfferResolvers,
} from "./index.js"

describe("commerce runtime", () => {
  it("expands to the commercial runtime modules in stable order", () => {
    const modules = createCommerceHonoModules()

    expect(modules.map((mod) => mod.module.name)).toEqual([...commerceRuntimeModuleNames])
  })

  it("exports a Commerce-named storefront offer resolver factory", () => {
    const resolvers = createCommerceStorefrontOfferResolvers()

    expect(typeof resolvers.listApplicableOffers).toBe("function")
    expect(typeof resolvers.getOfferBySlug).toBe("function")
    expect(typeof resolvers.applyOffer).toBe("function")
    expect(typeof resolvers.redeemOffer).toBe("function")
  })
})

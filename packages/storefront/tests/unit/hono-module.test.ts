import { describe, expect, it } from "vitest"

import { createStorefrontHonoModule, storefrontAnonymousPublicPaths } from "../../src/index.js"

describe("createStorefrontHonoModule", () => {
  it("declares anonymous storefront offer paths next to the owned public routes", () => {
    const module = createStorefrontHonoModule()

    expect(module.publicPath).toBe("/")
    expect(module.anonymous).toBe(storefrontAnonymousPublicPaths)
    expect(module.anonymous).toContain("/offers")
  })
})

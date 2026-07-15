import { describe, expect, it } from "vitest"

import { createSelectedCommerceAdminExtension } from "./admin.js"
import { parseMarketSetupPrefill } from "./markets/setup-prefill.js"

describe("createSelectedCommerceAdminExtension", () => {
  it("falls back to stable English selected navigation copy", () => {
    const extension = createSelectedCommerceAdminExtension({ navMessages: {} })
    expect(extension.navigation?.[0]?.items[0]?.title).toBe("Promotions")
    expect(extension.routes?.[0]?.title).toBe("Promotions")
    expect(extension.setupSteps?.[0]).toMatchObject({
      id: "@voyant-travel/commerce#setup.market",
      href: "/settings/markets",
    })
  })

  it("uses selected navigation copy when supplied", () => {
    const extension = createSelectedCommerceAdminExtension({
      navMessages: { promotions: "Promotii" },
    })
    expect(extension.navigation?.[0]?.items[0]?.title).toBe("Promotii")
    expect(extension.routes?.[0]?.title).toBe("Promotii")
  })

  it("validates provisioning defaults for the package-owned market form", () => {
    expect(
      parseMarketSetupPrefill({
        name: "Romania",
        regionCode: "EU",
        defaultLanguageTag: "ro-RO",
        defaultCurrency: "RON",
        ignored: "value",
        timezone: 42,
      }),
    ).toEqual({
      name: "Romania",
      regionCode: "EU",
      defaultLanguageTag: "ro-RO",
      defaultCurrency: "RON",
    })
  })
})

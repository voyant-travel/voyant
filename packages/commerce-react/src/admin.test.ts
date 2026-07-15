import { describe, expect, it } from "vitest"

import { createSelectedCommerceAdminExtension } from "./admin.js"

describe("createSelectedCommerceAdminExtension", () => {
  it("falls back to stable English selected navigation copy", () => {
    const extension = createSelectedCommerceAdminExtension({ navMessages: {} })
    expect(extension.navigation?.[0]?.items[0]?.title).toBe("Promotions")
    expect(extension.routes?.[0]?.title).toBe("Promotions")
  })

  it("uses selected navigation copy when supplied", () => {
    const extension = createSelectedCommerceAdminExtension({
      navMessages: { promotions: "Promotii" },
    })
    expect(extension.navigation?.[0]?.items[0]?.title).toBe("Promotii")
    expect(extension.routes?.[0]?.title).toBe("Promotii")
  })
})

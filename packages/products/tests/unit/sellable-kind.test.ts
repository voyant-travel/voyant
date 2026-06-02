import { describe, expect, it } from "vitest"

import { inferProductSellableKind } from "../../src/sellable-kind.js"

describe("inferProductSellableKind", () => {
  it("defaults to product when no package signal is present", () => {
    expect(inferProductSellableKind()).toBe("product")
    expect(inferProductSellableKind({ tags: ["wellness"] })).toBe("product")
  })

  it("treats explicit package markers as package", () => {
    expect(inferProductSellableKind({ tags: ["tour-package"] })).toBe("package")
    expect(inferProductSellableKind({ productTypeCode: "package" })).toBe("package")
  })

  it("infers package from multi-day accommodation plus transport capabilities", () => {
    expect(
      inferProductSellableKind({
        capabilities: ["multi_day", "accommodation", "transport"],
      }),
    ).toBe("package")
  })

  it("keeps narrower booking-mode facets when no package signal exists", () => {
    expect(inferProductSellableKind({ bookingMode: "transfer" })).toBe("transfer")
    expect(inferProductSellableKind({ bookingMode: "stay" })).toBe("accommodation")
  })
})

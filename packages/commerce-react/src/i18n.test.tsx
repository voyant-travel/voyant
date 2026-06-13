import { describe, expect, it } from "vitest"
import {
  CommerceUiMessagesProvider,
  marketsUiEn,
  pricingUiEn,
  promotionsUiEn,
  sellabilityUiEn,
} from "./i18n.js"

describe("@voyantjs/commerce-react i18n facade", () => {
  it("exports the composed provider and commercial message bundles", () => {
    expect(typeof CommerceUiMessagesProvider).toBe("function")
    expect(marketsUiEn).toBeTruthy()
    expect(pricingUiEn).toBeTruthy()
    expect(promotionsUiEn).toBeTruthy()
    expect(sellabilityUiEn).toBeTruthy()
  })
})

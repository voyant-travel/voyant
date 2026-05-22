import { describe, expect, it } from "vitest"

import { buildPaymentLinkUrl } from "../../src/payment-link.js"

describe("buildPaymentLinkUrl", () => {
  it("builds a customer-facing payment URL from a configured base", () => {
    expect(buildPaymentLinkUrl("pmss_123", { baseUrl: "https://travel.example.com/" })).toBe(
      "https://travel.example.com/pay/pmss_123",
    )
  })

  it("preserves base URL path prefixes", () => {
    expect(buildPaymentLinkUrl("pmss_123", { baseUrl: "https://example.com/ro" })).toBe(
      "https://example.com/ro/pay/pmss_123",
    )
  })

  it("falls back to a root-relative URL outside the browser", () => {
    expect(buildPaymentLinkUrl("pmss 123")).toBe("/pay/pmss%20123")
  })
})

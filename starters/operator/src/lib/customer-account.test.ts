import { describe, expect, it } from "vitest"

import { rewriteCustomerAccountAuthUrl } from "./customer-account"

describe("rewriteCustomerAccountAuthUrl", () => {
  it("routes customer auth UI calls through the customer auth facade", () => {
    expect(rewriteCustomerAccountAuthUrl("https://example.test/api/auth/sign-in/email")).toBe(
      "https://example.test/api/auth/customer/sign-in/email",
    )
    expect(rewriteCustomerAccountAuthUrl("https://example.test/api/auth/sign-up/email")).toBe(
      "https://example.test/api/auth/customer/sign-up/email",
    )
  })

  it("keeps auth status calls out of the admin provisioning endpoint", () => {
    expect(rewriteCustomerAccountAuthUrl("https://example.test/api/auth/status")).toBe(
      "https://example.test/api/auth/customer/status",
    )
  })

  it("leaves public API calls unchanged", () => {
    expect(
      rewriteCustomerAccountAuthUrl("https://example.test/api/v1/public/customer-portal/me"),
    ).toBe("https://example.test/api/v1/public/customer-portal/me")
  })

  it("does not double-prefix customer auth calls", () => {
    expect(
      rewriteCustomerAccountAuthUrl("https://example.test/api/auth/customer/sign-in/email"),
    ).toBe("https://example.test/api/auth/customer/sign-in/email")
  })
})

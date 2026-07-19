import { describe, expect, it } from "vitest"

import {
  customerOrganizationInvitationUrl,
  withCustomerPublicResetPasswordUrl,
  withCustomerSocialRedirectUris,
} from "../../src/node-runtime.js"

describe("customer auth runtime options", () => {
  it("builds invitation links from an exact trusted origin", () => {
    expect(customerOrganizationInvitationUrl("https://shop.example.com", "invitation/id")).toBe(
      "https://shop.example.com/account/business-invitations/invitation%2Fid",
    )
    expect(() =>
      customerOrganizationInvitationUrl("https://shop.example.com/untrusted", "invitation"),
    ).toThrow(/exact trusted HTTP\(S\) origin/)
  })
  it("uses the browser-visible API callback for configured social providers", () => {
    const methods = withCustomerSocialRedirectUris(
      {
        socialProviders: {
          google: { clientId: "google-id", clientSecret: "google-secret" },
          facebook: { clientId: "facebook-id", clientSecret: "facebook-secret" },
          apple: { clientId: "apple-id", clientSecret: "apple-secret" },
        },
      },
      "https://shop.example.com/api/",
    )

    expect(methods.socialProviders?.google?.redirectURI).toBe(
      "https://shop.example.com/api/auth/customer/callback/google",
    )
    expect(methods.socialProviders?.facebook?.redirectURI).toBe(
      "https://shop.example.com/api/auth/customer/callback/facebook",
    )
    expect(methods.socialProviders?.apple?.redirectURI).toBe(
      "https://shop.example.com/api/auth/customer/callback/apple",
    )
  })

  it("preserves an explicitly resolved merchant callback", () => {
    const methods = withCustomerSocialRedirectUris(
      {
        socialProviders: {
          google: {
            clientId: "google-id",
            clientSecret: "google-secret",
            redirectURI: "https://merchant.example/custom/google-callback",
          },
        },
      },
      "https://shop.example.com/api",
    )

    expect(methods.socialProviders?.google?.redirectURI).toBe(
      "https://merchant.example/custom/google-callback",
    )
  })

  it("rewrites generated reset-password links through the public storefront API", () => {
    expect(
      withCustomerPublicResetPasswordUrl(
        "https://runtime.internal/auth/customer/reset-password/token-123?callbackURL=%2Faccount",
        "https://shop.example.com/api/",
      ),
    ).toBe(
      "https://shop.example.com/api/auth/customer/reset-password/token-123?callbackURL=%2Faccount",
    )
  })

  it("leaves malformed generated reset-password links untouched", () => {
    expect(withCustomerPublicResetPasswordUrl("not a URL", "https://shop.example.com/api")).toBe(
      "not a URL",
    )
  })
})

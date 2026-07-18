import { describe, expect, it } from "vitest"

import { withCustomerSocialRedirectUris } from "../../src/node-runtime.js"

describe("customer auth runtime options", () => {
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
})

import { describe, expect, it } from "vitest"

import { buildBetterAuthCookieAdvancedOptions } from "./cookie-domain"

describe("buildBetterAuthCookieAdvancedOptions", () => {
  it("leaves Better Auth cookie defaults untouched when AUTH_COOKIE_DOMAIN is unset", () => {
    expect(buildBetterAuthCookieAdvancedOptions({})).toBeUndefined()
    expect(buildBetterAuthCookieAdvancedOptions({ AUTH_COOKIE_DOMAIN: "   " })).toBeUndefined()
  })

  it("enables cross-subdomain Better Auth cookies for the configured domain", () => {
    expect(buildBetterAuthCookieAdvancedOptions({ AUTH_COOKIE_DOMAIN: " .example.com " })).toEqual({
      crossSubDomainCookies: {
        enabled: true,
        domain: ".example.com",
      },
      defaultCookieAttributes: {
        domain: ".example.com",
      },
    })
  })
})

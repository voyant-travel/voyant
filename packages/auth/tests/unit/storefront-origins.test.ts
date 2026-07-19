import { describe, expect, it } from "vitest"

import {
  isStorefrontOriginAllowed,
  normalizeStorefrontAllowedOrigins,
  normalizeStorefrontCustomerAccountPolicy,
  normalizeStorefrontCustomerAuthMethods,
  StorefrontInputError,
} from "../../src/storefront-origins.js"

describe("normalizeStorefrontAllowedOrigins", () => {
  it("accepts https origins, localhost http-with-port, and wildcards; dedupes + sorts", () => {
    expect(
      normalizeStorefrontAllowedOrigins([
        "https://shop.example.com",
        "https://shop.example.com/",
        "http://localhost:3000",
        "https://*.example.com",
      ]),
    ).toEqual(["http://localhost:3000", "https://*.example.com", "https://shop.example.com"])
  })

  it("permits http only for localhost / loopback", () => {
    expect(normalizeStorefrontAllowedOrigins(["http://127.0.0.1:8080"])).toEqual([
      "http://127.0.0.1:8080",
    ])
    expect(() => normalizeStorefrontAllowedOrigins(["http://shop.example.com"])).toThrow(
      StorefrontInputError,
    )
  })

  it("rejects paths, credentials, query, hash, empty, and malformed wildcards", () => {
    for (const bad of [
      "",
      "   ",
      "https://shop.example.com/path",
      "https://user:pass@shop.example.com",
      "https://shop.example.com?x=1",
      "https://shop.example.com#a",
      "not a url",
      "https://*.*.example.com",
      "https://*./",
      "https://*.example.com:8443",
    ]) {
      expect(() => normalizeStorefrontAllowedOrigins([bad])).toThrow(StorefrontInputError)
    }
  })
})

describe("isStorefrontOriginAllowed", () => {
  const allowed = ["https://shop.example.com", "https://*.example.com", "http://localhost:3000"]

  it("matches exact origins", () => {
    expect(isStorefrontOriginAllowed("https://shop.example.com", allowed)).toBe(true)
    expect(isStorefrontOriginAllowed("http://localhost:3000", allowed)).toBe(true)
  })

  it("matches a wildcard for exactly one extra label", () => {
    expect(isStorefrontOriginAllowed("https://app.example.com", allowed)).toBe(true)
    expect(isStorefrontOriginAllowed("https://a.b.example.com", allowed)).toBe(false)
    expect(isStorefrontOriginAllowed("https://example.com", allowed)).toBe(false)
  })

  it("never matches http against an https wildcard, nor unlisted origins", () => {
    expect(isStorefrontOriginAllowed("http://app.example.com", allowed)).toBe(false)
    expect(isStorefrontOriginAllowed("https://evil.com", allowed)).toBe(false)
    expect(isStorefrontOriginAllowed("https://shop.example.com/path", allowed)).toBe(false)
    expect(isStorefrontOriginAllowed("not-a-url", allowed)).toBe(false)
  })
})

describe("normalizeStorefrontCustomerAuthMethods", () => {
  it("coerces flags to strict booleans", () => {
    expect(
      normalizeStorefrontCustomerAuthMethods({
        emailCode: true,
        emailPassword: false,
        google: true,
        facebook: false,
        apple: false,
      }),
    ).toEqual({
      emailCode: true,
      emailPassword: false,
      google: true,
      facebook: false,
      apple: false,
    })
  })

  it("requires at least one enabled method", () => {
    expect(() =>
      normalizeStorefrontCustomerAuthMethods({
        emailCode: false,
        emailPassword: false,
        google: false,
        facebook: false,
        apple: false,
      }),
    ).toThrow(StorefrontInputError)
  })
})

describe("normalizeStorefrontCustomerAccountPolicy", () => {
  it("keeps a valid personal-only policy and orders kinds", () => {
    expect(
      normalizeStorefrontCustomerAccountPolicy({
        allowedKinds: ["business", "personal"],
        personalSignup: "open",
        businessOnboarding: "request",
      }),
    ).toEqual({
      allowedKinds: ["personal", "business"],
      personalSignup: "open",
      businessOnboarding: "request",
    })
  })

  it("enforces the personal / business gating invariants", () => {
    expect(() =>
      normalizeStorefrontCustomerAccountPolicy({
        allowedKinds: ["business"],
        personalSignup: "open",
        businessOnboarding: "open",
      }),
    ).toThrow(StorefrontInputError)
    expect(() =>
      normalizeStorefrontCustomerAccountPolicy({
        allowedKinds: ["business"],
        personalSignup: "disabled",
        businessOnboarding: "disabled",
      }),
    ).toThrow(StorefrontInputError)
    expect(() =>
      normalizeStorefrontCustomerAccountPolicy({
        allowedKinds: ["personal", "personal"],
        personalSignup: "open",
        businessOnboarding: "disabled",
      }),
    ).toThrow(StorefrontInputError)
  })
})

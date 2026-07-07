import { describe, expect, it } from "vitest"

import { deriveDefaultPhoneCountry, resolveDefaultPhoneCountry } from "./shared.js"

// #2968 — phone inputs used to hardcode GB. The resolver now prefers an
// explicit deployment setting, then a locale-derived region, keeping GB only
// as the last-resort fallback.
describe("resolveDefaultPhoneCountry (#2968)", () => {
  it("prefers an explicit alpha-2 code over the locale", () => {
    expect(resolveDefaultPhoneCountry("RO", "en-GB")).toBe("RO")
  })

  it("normalizes and trims a valid explicit code", () => {
    expect(resolveDefaultPhoneCountry(" ro ", "en-GB")).toBe("RO")
  })

  it("derives the region subtag from a full locale tag", () => {
    expect(resolveDefaultPhoneCountry(undefined, "ro-RO")).toBe("RO")
    expect(resolveDefaultPhoneCountry(undefined, "en_US")).toBe("US")
    // Script subtag is skipped; the 2-letter region wins.
    expect(resolveDefaultPhoneCountry(undefined, "zh-Hant-TW")).toBe("TW")
  })

  it("does not invent a country from a bare language tag", () => {
    expect(resolveDefaultPhoneCountry(undefined, "ro")).toBe("GB")
    expect(resolveDefaultPhoneCountry(undefined, "en")).toBe("GB")
  })

  it("falls back to GB when neither input yields a country", () => {
    expect(resolveDefaultPhoneCountry(undefined, undefined)).toBe("GB")
    expect(resolveDefaultPhoneCountry("", "")).toBe("GB")
  })

  it("ignores malformed explicit values and falls through to the locale", () => {
    expect(resolveDefaultPhoneCountry("GBR", "ro-RO")).toBe("RO")
    expect(resolveDefaultPhoneCountry("1", "ro-RO")).toBe("RO")
  })
})

// #2968 follow-up — the journey resolves the scope locale (which storefronts
// thread even when the bookings-ui i18n provider isn't mounted) before the
// package i18n locale. `deriveDefaultPhoneCountry` returns `undefined` (not GB)
// so `PhoneField` can still consult the i18n locale afterwards.
describe("deriveDefaultPhoneCountry (#2968)", () => {
  it("prefers an explicit code, then the locale region", () => {
    expect(deriveDefaultPhoneCountry("RO", "en-GB")).toBe("RO")
    expect(deriveDefaultPhoneCountry(undefined, "ro-RO")).toBe("RO")
  })

  it("returns undefined instead of GB so a later locale can win", () => {
    expect(deriveDefaultPhoneCountry(undefined, undefined)).toBeUndefined()
    expect(deriveDefaultPhoneCountry(undefined, "ro")).toBeUndefined()
    expect(deriveDefaultPhoneCountry("", "")).toBeUndefined()
  })

  it("lets the scope locale resolve ahead of the i18n locale in PhoneField", () => {
    // What PhoneField effectively computes: derive(explicit, scopeLocale)
    // becomes the explicit input to resolve(explicit, i18nLocale). A Romanian
    // storefront (scope "ro-RO", i18n defaulting to "en") resolves to RO.
    const fromScope = deriveDefaultPhoneCountry(undefined, "ro-RO")
    expect(resolveDefaultPhoneCountry(fromScope, "en")).toBe("RO")

    // With no scope, the i18n locale still applies before GB.
    const noScope = deriveDefaultPhoneCountry(undefined, "en")
    expect(resolveDefaultPhoneCountry(noScope, "fr-FR")).toBe("FR")
  })
})

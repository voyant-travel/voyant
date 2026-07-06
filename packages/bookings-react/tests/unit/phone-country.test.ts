import { describe, expect, it } from "vitest"
import { resolveDefaultPhoneCountry } from "../../src/journey/lib/phone-country.js"

describe("resolveDefaultPhoneCountry", () => {
  it("prefers an explicit code over the locale", () => {
    expect(resolveDefaultPhoneCountry("US", "ro-RO")).toBe("US")
  })

  it("normalizes a lowercase explicit code to uppercase", () => {
    expect(resolveDefaultPhoneCountry("fr", "en-US")).toBe("FR")
  })

  it("ignores a malformed explicit code and falls back to the locale", () => {
    expect(resolveDefaultPhoneCountry("USA", "en-US")).toBe("US")
    expect(resolveDefaultPhoneCountry("", "ro-RO")).toBe("RO")
  })

  it("derives the region from a full locale tag", () => {
    expect(resolveDefaultPhoneCountry(undefined, "ro-RO")).toBe("RO")
    expect(resolveDefaultPhoneCountry(undefined, "en-US")).toBe("US")
  })

  it("maximizes a bare language tag to a region", () => {
    expect(resolveDefaultPhoneCountry(undefined, "ro")).toBe("RO")
    expect(resolveDefaultPhoneCountry(undefined, "de")).toBe("DE")
  })

  it("falls back to GB for garbage or empty locales", () => {
    expect(resolveDefaultPhoneCountry(undefined, "not a locale!!")).toBe("GB")
    expect(resolveDefaultPhoneCountry(undefined, "")).toBe("GB")
    expect(resolveDefaultPhoneCountry(undefined, null)).toBe("GB")
    expect(resolveDefaultPhoneCountry(undefined, undefined)).toBe("GB")
  })

  it("falls back to GB when a language tag has no derivable region", () => {
    // "und" (undetermined) maximizes to no meaningful region.
    expect(resolveDefaultPhoneCountry(undefined, "zxx")).toBe("GB")
  })
})

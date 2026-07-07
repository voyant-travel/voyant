import { describe, expect, it } from "vitest"

import { resolveDefaultPhoneCountry } from "./shared.js"

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

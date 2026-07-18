import { describe, expect, it } from "vitest"

import { ADMIN_UI_EXTENSION_API_VERSION, isUiExtensionCompatible } from "../../src/index.js"

describe("isUiExtensionCompatible", () => {
  it("pins the implemented version to 1.1.0", () => {
    expect(ADMIN_UI_EXTENSION_API_VERSION).toBe("1.1.0")
  })

  it("accepts ranges that include 1.1.0", () => {
    for (const range of [
      "^1",
      "^1.0",
      "^1.1",
      "^1.1.0",
      "1.x",
      "1.1.x",
      "1",
      "1.1",
      "1.1.0",
      "*",
      "x",
    ]) {
      expect(isUiExtensionCompatible(range)).toBe(true)
    }
  })

  it("rejects ranges that exclude 1.1.0", () => {
    for (const range of ["^2", "^1.2", "^0.9", "2.x", "1.0.x", "0", "2.0.0", "1.1.1", "1.0.0"]) {
      expect(isUiExtensionCompatible(range)).toBe(false)
    }
  })

  it("rejects malformed ranges", () => {
    for (const range of ["", "   ", "abc", "^", "1.2.3.4", "~1.0.0", ">=1.0.0", "1.0.0-beta"]) {
      expect(isUiExtensionCompatible(range)).toBe(false)
    }
  })

  it("evaluates against an explicit target version", () => {
    expect(isUiExtensionCompatible("^1.2", "1.4.0")).toBe(true)
    expect(isUiExtensionCompatible("^1.2", "1.1.0")).toBe(false)
    expect(isUiExtensionCompatible("1.2.x", "1.2.9")).toBe(true)
    expect(isUiExtensionCompatible("1.2.x", "1.3.0")).toBe(false)
    expect(isUiExtensionCompatible("^0.2", "0.2.5")).toBe(true)
    expect(isUiExtensionCompatible("^0.2", "0.3.0")).toBe(false)
  })
})

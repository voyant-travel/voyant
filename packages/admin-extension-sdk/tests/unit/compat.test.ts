import { describe, expect, it } from "vitest"
import { ADMIN_UI_EXTENSION_API_VERSION, isUiExtensionCompatible } from "../../src/index.js"

describe("isUiExtensionCompatible (SDK-owned matcher)", () => {
  it("evaluates ranges against the implemented version", () => {
    expect(ADMIN_UI_EXTENSION_API_VERSION).toBe("1.1.0")
    for (const range of ["^1", "^1.1", "1.x", "1.1.x", "*"]) {
      expect(isUiExtensionCompatible(range)).toBe(true)
    }
    for (const range of ["^2", "^1.2", "2.x", "1.0.0", ""]) {
      expect(isUiExtensionCompatible(range)).toBe(false)
    }
  })

  it("evaluates against an explicit target version", () => {
    expect(isUiExtensionCompatible("^1.2", "1.4.0")).toBe(true)
    expect(isUiExtensionCompatible("^1.2", "1.1.0")).toBe(false)
    expect(isUiExtensionCompatible("1.2.x", "1.2.9")).toBe(true)
    expect(isUiExtensionCompatible("1.2.x", "1.3.0")).toBe(false)
  })
})

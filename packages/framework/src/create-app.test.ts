import { describe, expect, it } from "vitest"
import { subsetStandardManifest } from "./create-app.js"
import { FRAMEWORK_RUNTIME_MANIFEST } from "./manifest.js"

describe("subsetStandardManifest (ADR-0007 module subsetting)", () => {
  it("returns the full standard set when nothing is excluded", () => {
    const { modules, extensions } = subsetStandardManifest()
    expect(modules).toEqual([...FRAMEWORK_RUNTIME_MANIFEST.modules])
    expect(extensions).toEqual([...FRAMEWORK_RUNTIME_MANIFEST.extensions])
  })

  describe("exclude (remove)", () => {
    it("drops an excluded module that nothing depends on", () => {
      const { modules } = subsetStandardManifest({ exclude: ["@voyant-travel/flights"] })
      expect(modules).not.toContain("@voyant-travel/flights")
      expect(modules).toContain("@voyant-travel/bookings") // neighbours untouched
    })

    it("rejects a typo'd exclude that isn't in the standard set", () => {
      expect(() => subsetStandardManifest({ exclude: ["@voyant-travel/does-not-exist"] })).toThrow(
        /not in the standard set/,
      )
    })

    it("rejects excluding an isRequired core module", () => {
      for (const required of [
        "@voyant-travel/identity",
        "@voyant-travel/action-ledger",
        "@voyant-travel/commerce",
      ]) {
        expect(() => subsetStandardManifest({ exclude: [required] })).toThrow(
          /cannot exclude required module/,
        )
      }
    })

    it("rejects excluding relationships — CRM is required (extend via custom fields)", () => {
      expect(() => subsetStandardManifest({ exclude: ["@voyant-travel/relationships"] })).toThrow(
        /cannot exclude required module.*relationships/,
      )
    })
  })
})

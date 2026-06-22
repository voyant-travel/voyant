import { describe, expect, it } from "vitest"
import { subsetStandardManifest } from "./create-app.js"
import { FRAMEWORK_RUNTIME_MANIFEST } from "./manifest.js"

describe("subsetStandardManifest (ADR-0007 module subsetting)", () => {
  it("returns the full standard set when nothing is excluded or overridden", () => {
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

    it("rejects excluding an isRequired module", () => {
      expect(() => subsetStandardManifest({ exclude: ["@voyant-travel/identity"] })).toThrow(
        /cannot exclude required module/,
      )
    })

    it("rejects dropping relationships while its consumers remain, naming them", () => {
      expect(() => subsetStandardManifest({ exclude: ["@voyant-travel/relationships"] })).toThrow(
        /unmet capabilities: "people-directory" \(required by .*bookings.*legal.*storefront/,
      )
    })

    it("allows dropping relationships together with every consumer", () => {
      const { modules } = subsetStandardManifest({
        exclude: [
          "@voyant-travel/relationships",
          "@voyant-travel/bookings",
          "@voyant-travel/legal",
          "@voyant-travel/storefront",
          "@voyant-travel/storefront/customer-portal",
        ],
      })
      expect(modules).not.toContain("@voyant-travel/relationships")
      expect(modules).not.toContain("@voyant-travel/bookings")
    })
  })

  describe("overrideCapabilities (replace)", () => {
    it("auto-displaces the default provider when its capability is overridden", () => {
      // No explicit exclude — naming the capability displaces relationships.
      const { modules } = subsetStandardManifest({ overrideCapabilities: ["people-directory"] })
      expect(modules).not.toContain("@voyant-travel/relationships")
      // Consumers still mount and read person/org through the injected substitute.
      expect(modules).toContain("@voyant-travel/bookings")
      expect(modules).toContain("@voyant-travel/legal")
      expect(modules).toContain("@voyant-travel/storefront")
    })

    it("rejects overriding a capability no standard module provides (typo)", () => {
      expect(() => subsetStandardManifest({ overrideCapabilities: ["peeple-directory"] })).toThrow(
        /no standard module provides/,
      )
    })
  })
})

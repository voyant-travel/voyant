import { describe, expect, it } from "vitest"
import {
  FRAMEWORK_EXTENSION_OWNERSHIP,
  FRAMEWORK_RUNTIME_MANIFEST,
  ownedExtensionsForExcludedModules,
  subsetStandardManifest,
} from "./manifest.js"

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

  describe("extension-ownership cascade (voyant#2104)", () => {
    it("cascades: excluding a module drops the extensions it owns", () => {
      const { modules, extensions } = subsetStandardManifest({
        exclude: ["@voyant-travel/bookings"],
      })
      expect(modules).not.toContain("@voyant-travel/bookings")
      // Every extension owned by bookings must be gone — none may leak onto the
      // now-absent bookings surface.
      const ownership: Record<string, readonly string[]> = FRAMEWORK_EXTENSION_OWNERSHIP
      for (const [extension, owners] of Object.entries(ownership)) {
        if (owners.includes("@voyant-travel/bookings")) {
          expect(extensions).not.toContain(extension)
        }
      }
      // A path-mounted extension whose owner survives stays mounted.
      expect(extensions).toContain("operator/catalog-offers-extension")
    })

    it("cascades path-mounted extensions with no same-named module", () => {
      // `operator/proposal-extension` mounts under `quote-versions` and is owned
      // by quotes — a name-match check would never catch it.
      const { extensions } = subsetStandardManifest({ exclude: ["@voyant-travel/quotes"] })
      expect(extensions).not.toContain("operator/proposal-extension")
      expect(extensions).not.toContain("operator/quote-version-snapshot-extension")
    })

    it("does not drop extensions when no owner is excluded", () => {
      const { extensions } = subsetStandardManifest({ exclude: ["@voyant-travel/flights"] })
      expect(extensions).toEqual([...FRAMEWORK_RUNTIME_MANIFEST.extensions])
    })

    it("ownedExtensionsForExcludedModules is declaration-driven, not name-matched", () => {
      const owned = ownedExtensionsForExcludedModules(["@voyant-travel/quotes"])
      expect(owned).toContain("operator/proposal-extension")
      expect(ownedExtensionsForExcludedModules([])).toEqual([])
    })
  })
})

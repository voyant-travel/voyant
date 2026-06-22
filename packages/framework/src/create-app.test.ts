import { describe, expect, it } from "vitest"
import { subsetStandardManifest } from "./create-app.js"
import { FRAMEWORK_RUNTIME_MANIFEST } from "./manifest.js"

describe("subsetStandardManifest (ADR-0007 module subsetting)", () => {
  it("returns the full standard set when nothing is excluded", () => {
    const { modules, extensions } = subsetStandardManifest()
    expect(modules).toEqual([...FRAMEWORK_RUNTIME_MANIFEST.modules])
    expect(extensions).toEqual([...FRAMEWORK_RUNTIME_MANIFEST.extensions])
  })

  it("drops an excluded module that nothing depends on", () => {
    const { modules } = subsetStandardManifest(["@voyant-travel/flights"])
    expect(modules).not.toContain("@voyant-travel/flights")
    // Untouched neighbours stay, in order.
    expect(modules).toContain("@voyant-travel/bookings")
  })

  it("rejects a typo'd exclude that isn't in the standard set", () => {
    expect(() => subsetStandardManifest(["@voyant-travel/does-not-exist"])).toThrow(
      /not in the standard set/,
    )
  })

  it("rejects dropping relationships while its consumers remain, naming them", () => {
    expect(() => subsetStandardManifest(["@voyant-travel/relationships"])).toThrow(
      /unmet capabilities: "people-directory" \(required by .*bookings.*legal.*storefront/,
    )
  })

  it("allows dropping relationships when a substitute provides the capability", () => {
    const { modules } = subsetStandardManifest(
      ["@voyant-travel/relationships"],
      ["people-directory"],
    )
    expect(modules).not.toContain("@voyant-travel/relationships")
    // Consumers still mount and read person/org through the injected port.
    expect(modules).toContain("@voyant-travel/bookings")
    expect(modules).toContain("@voyant-travel/legal")
  })

  it("allows dropping relationships together with every consumer (no substitute needed)", () => {
    const { modules } = subsetStandardManifest([
      "@voyant-travel/relationships",
      "@voyant-travel/bookings",
      "@voyant-travel/legal",
      "@voyant-travel/storefront",
    ])
    expect(modules).not.toContain("@voyant-travel/relationships")
    expect(modules).not.toContain("@voyant-travel/bookings")
  })
})

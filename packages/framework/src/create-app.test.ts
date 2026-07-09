import { describe, expect, it } from "vitest"
import type { FrameworkProviders } from "./composition-lazy.js"
import { optionalFamiliesToExclude } from "./create-app.js"

/** Cast a loose record to the providers slice the helper reads (avoids stubbing every field). */
function providersWith(fields: Record<string, unknown>): Partial<FrameworkProviders> {
  return fields as Partial<FrameworkProviders>
}

describe("optionalFamiliesToExclude (auto-exclude unwired optional families)", () => {
  it("excludes @voyant-travel/flights when loadFlightAdminRoutes is not provided", () => {
    expect(optionalFamiliesToExclude({})).toContain("@voyant-travel/flights")
  })

  it("keeps flights when the loader is provided", () => {
    const excluded = optionalFamiliesToExclude(providersWith({ loadFlightAdminRoutes: () => {} }))
    expect(excluded).not.toContain("@voyant-travel/flights")
  })

  it("does not exclude required (non-optional) families", () => {
    // Only families in OPTIONAL_FAMILY_LOADERS can be auto-excluded; an empty
    // providers object must not drop the core standard set.
    expect(optionalFamiliesToExclude({})).toEqual(["@voyant-travel/flights"])
  })
})

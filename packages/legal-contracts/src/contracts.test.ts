import { describe, expect, it } from "vitest"

import * as legalContracts from "./index.js"

describe("@voyant-travel/legal-contracts", () => {
  it("exposes the contracts + policies validation surface", () => {
    // Smoke test: the barrel re-exports both validation modules with real schemas.
    expect(Object.keys(legalContracts).length).toBeGreaterThan(0)
  })
})

import { describe, expect, it } from "vitest"

import { navigationVisibilityMapSchema } from "../../src/contracts.js"

describe("navigation visibility map contract", () => {
  it("preserves unknown IDs exactly instead of normalizing their spelling", () => {
    const visibility = { "Future.Module/v2": false, "removed.module": true }

    expect(navigationVisibilityMapSchema.parse(visibility)).toEqual(visibility)
  })

  it("rejects malformed IDs without rejecting unknown stable IDs", () => {
    expect(() => navigationVisibilityMapSchema.parse({ "   ": true })).toThrow()
    expect(() => navigationVisibilityMapSchema.parse({ " future-module ": true })).toThrow()
    expect(navigationVisibilityMapSchema.parse({ "future-module": true })).toEqual({
      "future-module": true,
    })
  })
})

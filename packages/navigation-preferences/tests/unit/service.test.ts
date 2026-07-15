import { describe, expect, it } from "vitest"

import { resolveEffectiveNavigationVisibility } from "../../src/service.js"

describe("effective navigation preferences", () => {
  it("lets member values override organization defaults and preserves unknown IDs", () => {
    expect(
      resolveEffectiveNavigationVisibility(
        { finance: false, bookings: true, "future-module": false },
        { finance: true },
      ),
    ).toEqual({ finance: true, bookings: true, "future-module": false })
  })
})

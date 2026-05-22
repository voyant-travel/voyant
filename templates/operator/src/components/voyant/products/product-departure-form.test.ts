import { describe, expect, it } from "vitest"

import { computeRemainingPaxForUpdate } from "./product-departure-form.js"

describe("computeRemainingPaxForUpdate", () => {
  it("returns null when initialPax is null (unlimited slot)", () => {
    expect(
      computeRemainingPaxForUpdate(null, {
        isEditing: false,
        previousInitialPax: null,
        previousRemainingPax: null,
      }),
    ).toBe(null)
  })

  it("returns initialPax for a fresh slot (no previous state to preserve)", () => {
    expect(
      computeRemainingPaxForUpdate(10, {
        isEditing: false,
        previousInitialPax: null,
        previousRemainingPax: null,
      }),
    ).toBe(10)
  })

  it("preserves consumed count when editing the same-capacity slot (#1087 main bug)", () => {
    // Capacity 38, 26 booked → remaining 12. After any edit, the running
    // consumed count must survive.
    expect(
      computeRemainingPaxForUpdate(38, {
        isEditing: true,
        previousInitialPax: 38,
        previousRemainingPax: 12,
      }),
    ).toBe(12)
  })

  it("expands remaining when capacity grows on edit", () => {
    // 10 → 15, 4 consumed: remaining should be 15 - 4 = 11.
    expect(
      computeRemainingPaxForUpdate(15, {
        isEditing: true,
        previousInitialPax: 10,
        previousRemainingPax: 6,
      }),
    ).toBe(11)
  })

  it("shrinks remaining when capacity drops on edit but stays >= 0", () => {
    // 10 → 8, 4 consumed: remaining should be 8 - 4 = 4.
    expect(
      computeRemainingPaxForUpdate(8, {
        isEditing: true,
        previousInitialPax: 10,
        previousRemainingPax: 6,
      }),
    ).toBe(4)
  })

  it("clamps to 0 if the new capacity is below what's already consumed", () => {
    // Defensive: form should prevent this, but the math should be safe.
    expect(
      computeRemainingPaxForUpdate(3, {
        isEditing: true,
        previousInitialPax: 10,
        previousRemainingPax: 6,
      }),
    ).toBe(0)
  })

  it("treats missing previous state as no consumed seats", () => {
    expect(
      computeRemainingPaxForUpdate(10, {
        isEditing: true,
        previousInitialPax: null,
        previousRemainingPax: null,
      }),
    ).toBe(10)
  })

  it("returns null when editing into unlimited mode", () => {
    // Caller passes `initialPax = null` when the unlimited flag is on; the
    // helper should follow that signal regardless of previous state.
    expect(
      computeRemainingPaxForUpdate(null, {
        isEditing: true,
        previousInitialPax: 10,
        previousRemainingPax: 6,
      }),
    ).toBe(null)
  })
})

import { describe, expect, it } from "vitest"

import {
  emptyDraft,
  patchBilling,
  patchConfigure,
  patchPaxCount,
  setAddons,
  setPayment,
  setTravelers,
  totalPax,
} from "../../src/journey/lib/draft-state.js"

const ENTITY = {
  module: "products",
  id: "prod_1",
  sourceKind: "owned",
} as const

describe("draft-state", () => {
  it("emptyDraft seeds B2C defaults by default", () => {
    const draft = emptyDraft(ENTITY)
    expect(draft.billing.buyerType).toBe("B2C")
    expect(draft.payment.intent).toBe("hold")
    expect(draft.travelers).toEqual([])
    expect(draft.addons).toEqual([])
    expect(draft.configure.pax).toEqual({})
  })

  it("emptyDraft honors B2B override", () => {
    const draft = emptyDraft(ENTITY, { buyerType: "B2B" })
    expect(draft.billing.buyerType).toBe("B2B")
  })

  it("patchPaxCount updates the right band only", () => {
    const draft = emptyDraft(ENTITY)
    const next = patchPaxCount(draft, "adult", 2)
    expect(next.configure.pax.adult).toBe(2)
    expect(next.configure.pax.child).toBeUndefined()
    // Original draft must not be mutated.
    expect(draft.configure.pax.adult).toBeUndefined()
  })

  it("patchPaxCount clamps negatives to 0", () => {
    const draft = emptyDraft(ENTITY)
    const next = patchPaxCount(draft, "adult", -3)
    expect(next.configure.pax.adult).toBe(0)
  })

  it("totalPax sums all bands", () => {
    let draft = emptyDraft(ENTITY)
    draft = patchPaxCount(draft, "adult", 2)
    draft = patchPaxCount(draft, "child", 1)
    expect(totalPax(draft)).toBe(3)
  })

  it("patchBilling preserves unrelated fields", () => {
    const draft = emptyDraft(ENTITY)
    const next = patchBilling(draft, { buyerType: "B2B" })
    expect(next.billing.buyerType).toBe("B2B")
    expect(next.billing.contact).toBe(draft.billing.contact)
  })

  it("patchConfigure preserves the pax record", () => {
    let draft = emptyDraft(ENTITY)
    draft = patchPaxCount(draft, "adult", 2)
    const next = patchConfigure(draft, { departureDate: "2026-12-01" })
    expect(next.configure.departureDate).toBe("2026-12-01")
    expect(next.configure.pax.adult).toBe(2)
  })

  it("setTravelers / setAddons / setPayment replace whole slices", () => {
    const draft = emptyDraft(ENTITY)
    const t = setTravelers(draft, [{ firstName: "A", lastName: "B", band: "adult" } as never])
    expect(t.travelers).toHaveLength(1)
    const a = setAddons(t, [{ extraId: "x", quantity: 1 }])
    expect(a.addons).toHaveLength(1)
    const p = setPayment(a, { intent: "card" })
    expect(p.payment.intent).toBe("card")
  })
})

import { describe, expect, it } from "vitest"

import type { ExtraContent } from "../../src/content-shape.js"
import { extraContentSchema } from "../../src/content-shape.js"
import { buildExtraDraftShape } from "../../src/draft-shape.js"

const baseContent: ExtraContent = extraContentSchema.parse({
  extra: { id: "pxtr_abc", name: "Half-day Tour" },
  options: [
    { id: "opt_morning", name: "Morning slot", default_selected: true },
    { id: "opt_afternoon", name: "Afternoon slot" },
  ],
})

describe("buildExtraDraftShape — addon mode (default)", () => {
  it("hides configure / travelers / payment (extras layer onto a parent)", () => {
    const shape = buildExtraDraftShape(baseContent)
    expect(shape.showsConfigure).toBe(false)
    expect(shape.showsTravelers).toBe(false)
    expect(shape.showsPayment).toBe(false)
  })

  it("shows the addons step with the extra + its options as items", () => {
    const shape = buildExtraDraftShape(baseContent)
    expect(shape.showsAddons).toBe(true)
    expect(shape.addons?.catalog).toHaveLength(3) // extra + 2 options
    expect(shape.addons?.catalog?.[0]?.id).toBe("pxtr_abc")
    expect(shape.addons?.catalog?.[1]?.id).toBe("opt_morning")
  })

  it("infers addon kind from the extra's category — excursion → 'excursions'", () => {
    const content = extraContentSchema.parse({
      extra: { id: "pxtr_abc", name: "City Tour", category: "excursion" },
    })
    const shape = buildExtraDraftShape(content)
    expect(shape.addons?.catalog?.[0]?.kind).toBe("excursions")
  })

  it("infers addon kind from category — insurance → 'insurance'", () => {
    const content = extraContentSchema.parse({
      extra: { id: "pxtr_abc", name: "Travel insurance", category: "insurance" },
    })
    const shape = buildExtraDraftShape(content)
    expect(shape.addons?.catalog?.[0]?.kind).toBe("insurance")
  })

  it("falls back to 'extras' kind when category is unknown / unset", () => {
    const content = extraContentSchema.parse({
      extra: { id: "pxtr_abc", name: "Random extra" },
    })
    const shape = buildExtraDraftShape(content)
    expect(shape.addons?.catalog?.[0]?.kind).toBe("extras")
  })

  it("emits an empty travelerFields / bookingFields list in addon mode", () => {
    const shape = buildExtraDraftShape(baseContent)
    expect(shape.travelerFields).toEqual([])
    expect(shape.bookingFields).toEqual([])
    expect(shape.paymentIntents).toEqual([])
  })
})

describe("buildExtraDraftShape — standalone mode", () => {
  it("shows configure + travelers + payment when standalone is true", () => {
    const shape = buildExtraDraftShape(baseContent, { standalone: true })
    expect(shape.showsConfigure).toBe(true)
    expect(shape.showsTravelers).toBe(true)
    expect(shape.showsPayment).toBe(true)
    expect(shape.travelerFields.length).toBeGreaterThan(0)
    expect(shape.bookingFields.length).toBeGreaterThan(0)
    expect(shape.paymentIntents).toEqual(["hold", "card"])
  })
})

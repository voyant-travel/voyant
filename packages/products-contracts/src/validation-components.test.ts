import { describe, expect, it } from "vitest"

import {
  importProductComponentsSchema,
  insertProductComponentSchema,
  updateProductComponentSchema,
  validateMergedProductComponent,
} from "./validation-core.js"

const accommodationBinding = {
  type: "inline",
  content: {
    property: { name: "Sample Hotel" },
    room_type: { name: "Double room", max_occupancy: 2 },
    nights: 3,
  },
}

describe("product component validation", () => {
  it("accepts an accommodation component write payload", () => {
    const parsed = insertProductComponentSchema.parse({
      componentKind: "accommodation",
      title: "Hotel stay",
      binding: accommodationBinding,
    })

    expect(parsed.selection).toBe("fixed")
    expect(parsed.commitmentBoundary).toBe("internal")
    expect(parsed.priceDisposition).toBe("included")
    expect(parsed.choices).toEqual([])
    expect(parsed.media).toEqual([])
    expect(parsed.tags).toEqual([])
  })

  it("rejects binding content that does not match the component kind", () => {
    const result = insertProductComponentSchema.safeParse({
      componentKind: "accommodation",
      title: "Hotel stay",
      binding: {
        type: "inline",
        content: { legs: [{ mode: "coach" }] },
      },
    })

    expect(result.success).toBe(false)
  })

  it("validates merged update state", () => {
    const validation = validateMergedProductComponent("pcmp_test", {
      componentKind: "transport",
      title: "Coach transfer",
      summary: null,
      description: null,
      selection: "fixed",
      commitmentBoundary: "dependent_component",
      priceDisposition: "included",
      required: true,
      quantity: 1,
      sortOrder: 0,
      binding: {
        type: "inline",
        content: { legs: [{ mode: "coach", from: { name: "Airport" } }] },
      },
      choices: [],
      media: [],
      tags: [],
      metadata: null,
    })

    expect(validation).toMatchObject({ ok: true })
  })

  it("keeps partial component updates partial", () => {
    const parsed = updateProductComponentSchema.parse({ title: "Updated title" })

    expect(parsed).toEqual({ title: "Updated title" })
  })

  it("accepts a structured component import payload", () => {
    const parsed = importProductComponentsSchema.parse({
      mode: "replace",
      dryRun: true,
      components: [
        {
          componentKind: "accommodation",
          title: "Hotel stay",
          binding: accommodationBinding,
        },
      ],
    })

    expect(parsed.mode).toBe("replace")
    expect(parsed.dryRun).toBe(true)
    expect(parsed.components[0]?.selection).toBe("fixed")
  })
})

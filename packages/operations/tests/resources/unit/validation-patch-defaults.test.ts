import { describe, expect, it } from "vitest"

import {
  insertResourceAllocationSchema,
  insertResourcePoolSchema,
  insertResourceSchema,
  insertResourceSlotAssignmentSchema,
  updateResourceAllocationSchema,
  updateResourcePoolSchema,
  updateResourceSchema,
  updateResourceSlotAssignmentSchema,
} from "../../../src/resources/validation.js"

describe("resources PATCH validation", () => {
  it("does not apply resource create defaults to partial updates", () => {
    expect(updateResourceSchema.parse({ name: "Updated guide" })).toEqual({
      name: "Updated guide",
    })
    expect(updateResourcePoolSchema.parse({ name: "Updated pool" })).toEqual({
      name: "Updated pool",
    })
  })

  it("does not apply allocation create defaults to partial updates", () => {
    expect(updateResourceAllocationSchema.parse({ priority: 3 })).toEqual({ priority: 3 })
  })

  it("does not apply assignment create defaults to partial updates", () => {
    expect(updateResourceSlotAssignmentSchema.parse({ notes: "Confirmed" })).toEqual({
      notes: "Confirmed",
    })
  })

  it("keeps create defaults for resource, pool, allocation, and assignment payloads", () => {
    expect(
      insertResourceSchema.parse({
        kind: "guide",
        name: "Guide",
      }),
    ).toMatchObject({ active: true })
    expect(
      insertResourcePoolSchema.parse({
        kind: "guide",
        name: "Guides",
      }),
    ).toMatchObject({ active: true })
    expect(
      insertResourceAllocationSchema.parse({
        poolId: "repl_123",
        productId: "prod_123",
      }),
    ).toMatchObject({
      allocationMode: "shared",
      priority: 0,
      quantityRequired: 1,
    })
    expect(
      insertResourceSlotAssignmentSchema.parse({
        slotId: "slot_123",
        resourceId: "res_123",
      }),
    ).toMatchObject({ status: "reserved" })
  })
})

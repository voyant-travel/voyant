import { describe, expect, it } from "vitest"

import { insertResourceSlotAssignmentSchema } from "../../../src/resources/validation.js"

const validAssignment = {
  slotId: "slot_1",
  poolId: "pool_1",
  assignedAt: "2025-06-15T10:00:00.000Z",
}

describe("resource slot assignment validation", () => {
  it("requires a pool or resource on create", () => {
    expect(
      insertResourceSlotAssignmentSchema.safeParse({
        slotId: "slot_1",
        poolId: null,
        resourceId: null,
      }).success,
    ).toBe(false)
  })

  it("rejects releasedAt before assignedAt on create", () => {
    expect(
      insertResourceSlotAssignmentSchema.safeParse({
        ...validAssignment,
        status: "released",
        releasedAt: "2025-06-15T09:00:00.000Z",
      }).success,
    ).toBe(false)
  })

  it("requires released status and releasedAt to agree on create", () => {
    expect(
      insertResourceSlotAssignmentSchema.safeParse({
        ...validAssignment,
        status: "released",
      }).success,
    ).toBe(false)

    expect(
      insertResourceSlotAssignmentSchema.safeParse({
        ...validAssignment,
        status: "reserved",
        releasedAt: "2025-06-15T11:00:00.000Z",
      }).success,
    ).toBe(false)
  })

  it("accepts a coherent released assignment on create", () => {
    expect(
      insertResourceSlotAssignmentSchema.safeParse({
        ...validAssignment,
        status: "released",
        releasedAt: "2025-06-15T11:00:00.000Z",
      }).success,
    ).toBe(true)
  })
})

import { describe, expect, it } from "vitest"

import { resourceSlotAssignmentSingleResponse } from "./schemas.js"

describe("resource assignment schemas", () => {
  it("parses the backend assignment detail timestamp shape", () => {
    const parsed = resourceSlotAssignmentSingleResponse.safeParse({
      data: {
        id: "resa_1",
        slotId: "slot_1",
        poolId: "pool_1",
        resourceId: null,
        bookingId: null,
        status: "reserved",
        assignedAt: "2025-06-15T10:00:00.000Z",
        assignedBy: null,
        releasedAt: null,
        notes: null,
      },
    })

    expect(parsed.success ? parsed.data.data.assignedAt : null).toBe("2025-06-15T10:00:00.000Z")
  })
})

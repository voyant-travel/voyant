import { describe, expect, it } from "vitest"

import {
  type AllocatorResource,
  type AllocatorTraveler,
  planRoomAllocation,
  planVehicleSeatAllocation,
} from "../../../src/availability/auto-allocator.js"

function traveler(
  overrides: Partial<AllocatorTraveler> & { id: string; bookingId: string },
): AllocatorTraveler {
  return {
    bookingStatus: "confirmed",
    isLeadTraveler: false,
    sharingGroupId: null,
    hasAccessibilityNeeds: false,
    existingAllocationId: null,
    ...overrides,
  }
}

function room(
  overrides: Partial<AllocatorResource> & { id: string; capacity: number },
): AllocatorResource {
  return {
    kind: "room",
    flags: {},
    parentId: null,
    ...overrides,
  }
}

function seat(
  overrides: Partial<AllocatorResource> & { id: string; row: number; column: string },
): AllocatorResource {
  return {
    kind: "vehicle_seat",
    capacity: 1,
    flags: {},
    parentId: "vehicle-1",
    position: "window",
    ...overrides,
  }
}

describe("planRoomAllocation", () => {
  it("skips bookings outside the slot-active status set", () => {
    const plan = planRoomAllocation(
      [
        traveler({ id: "t1", bookingId: "b1", bookingStatus: "draft" }),
        traveler({ id: "t2", bookingId: "b2", bookingStatus: "expired" }),
        traveler({ id: "t3", bookingId: "b3", bookingStatus: "cancelled" }),
      ],
      [room({ id: "r1", capacity: 2 })],
    )

    expect(plan.assignments).toEqual([])
    expect(plan.skipped).toBe(0)
  })

  it("keeps a booking party together when capacity allows", () => {
    const plan = planRoomAllocation(
      [
        traveler({ id: "t1", bookingId: "b1", isLeadTraveler: true }),
        traveler({ id: "t2", bookingId: "b1" }),
      ],
      [room({ id: "r-double", capacity: 2 }), room({ id: "r-single", capacity: 1 })],
    )

    expect(plan.assignments.find((row) => row.travelerId === "t1")?.resourceId).toBe("r-double")
    expect(plan.assignments.find((row) => row.travelerId === "t2")?.resourceId).toBe("r-double")
    expect(plan.skipped).toBe(0)
  })

  it("prefers exact-fit rooms before larger rooms", () => {
    const plan = planRoomAllocation(
      [traveler({ id: "t1", bookingId: "b1", isLeadTraveler: true })],
      [room({ id: "r-double", capacity: 2 }), room({ id: "r-single", capacity: 1 })],
    )

    expect(plan.assignments).toEqual([{ travelerId: "t1", resourceId: "r-single" }])
  })

  it("prefers rooms with a matching template option before capacity tie-breakers", () => {
    const plan = planRoomAllocation(
      [
        traveler({ id: "t1", bookingId: "b1", optionId: "option-dbl" }),
        traveler({ id: "t2", bookingId: "b1", optionId: "option-dbl" }),
      ],
      [
        room({ id: "r-twn", capacity: 2, flags: { templateOptionId: "option-twn" } }),
        room({ id: "r-dbl", capacity: 2, flags: { templateOptionId: "option-dbl" } }),
      ],
    )

    expect(plan.assignments.find((row) => row.travelerId === "t1")?.resourceId).toBe("r-dbl")
    expect(plan.assignments.find((row) => row.travelerId === "t2")?.resourceId).toBe("r-dbl")
  })

  it("prefers rooms linked to the selected option unit", () => {
    const plan = planRoomAllocation(
      [
        traveler({ id: "t1", bookingId: "b1", optionUnitId: "unit-dbl" }),
        traveler({ id: "t2", bookingId: "b1", optionUnitId: "unit-dbl" }),
      ],
      [
        room({ id: "r-twn", capacity: 2, refType: "option_unit", refId: "unit-twn" }),
        room({ id: "r-dbl", capacity: 2, refType: "option_unit", refId: "unit-dbl" }),
      ],
    )

    expect(plan.assignments.find((row) => row.travelerId === "t1")?.resourceId).toBe("r-dbl")
    expect(plan.assignments.find((row) => row.travelerId === "t2")?.resourceId).toBe("r-dbl")
  })

  it("falls back to the resource label prefix for hand-materialized room types", () => {
    const plan = planRoomAllocation(
      [
        traveler({ id: "t1", bookingId: "b1", optionUnitCode: "dbl_room" }),
        traveler({ id: "t2", bookingId: "b1", optionUnitCode: "dbl_room" }),
      ],
      [
        room({ id: "r-twn", capacity: 2, label: "TWN #1" }),
        room({ id: "r-dbl", capacity: 2, label: "DBL #1" }),
      ],
    )

    expect(plan.assignments.find((row) => row.travelerId === "t1")?.resourceId).toBe("r-dbl")
    expect(plan.assignments.find((row) => row.travelerId === "t2")?.resourceId).toBe("r-dbl")
  })

  it("uses another room type when the preferred option-unit room is full", () => {
    const plan = planRoomAllocation(
      [
        traveler({
          id: "existing",
          bookingId: "b0",
          existingAllocationId: "r-dbl",
          optionUnitCode: "dbl_room",
        }),
        traveler({ id: "t1", bookingId: "b1", optionUnitCode: "dbl_room" }),
        traveler({ id: "t2", bookingId: "b1", optionUnitCode: "dbl_room" }),
      ],
      [room({ id: "r-dbl", capacity: 1, label: "DBL #1" }), room({ id: "r-twn", capacity: 2 })],
    )

    expect(plan.assignments.find((row) => row.travelerId === "existing")).toBeUndefined()
    expect(plan.assignments.find((row) => row.travelerId === "t1")?.resourceId).toBe("r-twn")
    expect(plan.assignments.find((row) => row.travelerId === "t2")?.resourceId).toBe("r-twn")
    expect(plan.skipped).toBe(0)
  })

  it("preserves existing assignments as no-op plan rows", () => {
    const plan = planRoomAllocation(
      [
        traveler({ id: "t1", bookingId: "b1", existingAllocationId: "r-pinned" }),
        traveler({ id: "t2", bookingId: "b2" }),
      ],
      [room({ id: "r-pinned", capacity: 1 }), room({ id: "r-free", capacity: 1 })],
    )

    expect(plan.assignments.find((row) => row.travelerId === "t1")).toBeUndefined()
    expect(plan.assignments.find((row) => row.travelerId === "t2")?.resourceId).toBe("r-free")
  })

  it("keeps sharing groups together across bookings", () => {
    const plan = planRoomAllocation(
      [
        traveler({ id: "alice", bookingId: "bA", sharingGroupId: "sg1", isLeadTraveler: true }),
        traveler({ id: "bob", bookingId: "bB", sharingGroupId: "sg1" }),
      ],
      [room({ id: "r-double", capacity: 2 }), room({ id: "r-single", capacity: 1 })],
    )

    expect(plan.assignments.find((row) => row.travelerId === "alice")?.resourceId).toBe("r-double")
    expect(plan.assignments.find((row) => row.travelerId === "bob")?.resourceId).toBe("r-double")
  })

  it("prefers accessibility rooms only for travelers who need them", () => {
    const accessible = room({
      id: "r-accessible",
      capacity: 1,
      flags: { accessibilityNeeded: true },
    })
    const plain = room({ id: "r-plain", capacity: 1 })

    expect(
      planRoomAllocation(
        [traveler({ id: "t1", bookingId: "b1", hasAccessibilityNeeds: true })],
        [plain, accessible],
      ).assignments,
    ).toEqual([{ travelerId: "t1", resourceId: "r-accessible" }])

    expect(
      planRoomAllocation([traveler({ id: "t2", bookingId: "b2" })], [plain, accessible])
        .assignments,
    ).toEqual([{ travelerId: "t2", resourceId: "r-plain" }])
  })

  it("reports skipped travelers when no room fits the group", () => {
    const plan = planRoomAllocation(
      [
        traveler({ id: "t1", bookingId: "b1" }),
        traveler({ id: "t2", bookingId: "b1" }),
        traveler({ id: "t3", bookingId: "b1" }),
      ],
      [room({ id: "r-double", capacity: 2 })],
    )

    expect(plan.assignments).toEqual([])
    expect(plan.skipped).toBe(3)
  })
})

describe("planVehicleSeatAllocation", () => {
  it("places solo lead travelers in window seats first", () => {
    const plan = planVehicleSeatAllocation(
      [traveler({ id: "t1", bookingId: "b1", isLeadTraveler: true })],
      [
        seat({ id: "s-aisle", row: 1, column: "B", position: "aisle" }),
        seat({ id: "s-window", row: 1, column: "A", position: "window" }),
      ],
    )

    expect(plan.assignments).toEqual([{ travelerId: "t1", resourceId: "s-window" }])
  })

  it("seats sharing groups in contiguous same-row seats", () => {
    const plan = planVehicleSeatAllocation(
      [
        traveler({ id: "alice", bookingId: "bA", sharingGroupId: "sg1", isLeadTraveler: true }),
        traveler({ id: "bob", bookingId: "bB", sharingGroupId: "sg1" }),
      ],
      [
        seat({ id: "s-1A", row: 1, column: "A", position: "window" }),
        seat({ id: "s-2A", row: 2, column: "A", position: "window" }),
        seat({ id: "s-2B", row: 2, column: "B", position: "aisle" }),
      ],
    )

    expect(plan.assignments.find((row) => row.travelerId === "alice")?.resourceId).toBe("s-2A")
    expect(plan.assignments.find((row) => row.travelerId === "bob")?.resourceId).toBe("s-2B")
  })

  it("reports skipped travelers when not enough free seats exist", () => {
    const plan = planVehicleSeatAllocation(
      [
        traveler({ id: "t1", bookingId: "b1" }),
        traveler({ id: "t2", bookingId: "b1" }),
        traveler({ id: "t3", bookingId: "b1" }),
      ],
      [seat({ id: "s1", row: 1, column: "A" }), seat({ id: "s2", row: 1, column: "B" })],
    )

    expect(plan.assignments).toEqual([])
    expect(plan.skipped).toBe(3)
  })
})

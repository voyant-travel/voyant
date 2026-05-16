import type { AllocationResource } from "@voyantjs/availability-react"
import { describe, expect, it } from "vitest"

import { groupResourcesBySubType, summarizeResourceCapacity } from "./slot-allocation-model.js"

function resource(overrides: Partial<AllocationResource> & { id: string }): AllocationResource {
  return {
    id: overrides.id,
    slotId: overrides.slotId ?? "slot_1",
    kind: overrides.kind ?? "room",
    refType: overrides.refType ?? null,
    refId: overrides.refId ?? null,
    label: overrides.label ?? null,
    capacity: overrides.capacity ?? 1,
    flags: overrides.flags ?? {},
    parentId: overrides.parentId ?? null,
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00Z",
  }
}

describe("groupResourcesBySubType", () => {
  it("groups by alphabetic label prefix so DBLs and SGLs stay together", () => {
    const groups = groupResourcesBySubType([
      resource({ id: "1", label: "DBL 1", capacity: 2 }),
      resource({ id: "2", label: "SGL 1", capacity: 1 }),
      resource({ id: "3", label: "DBL 2", capacity: 2 }),
      resource({ id: "4", label: "SGL 2", capacity: 1 }),
      resource({ id: "5", label: "DBL 3", capacity: 2 }),
    ])
    expect(groups.map((g) => g.label)).toEqual(["DBL", "SGL"])
    expect(groups[0]?.count).toBe(3)
    expect(groups[0]?.capacity).toBe(6)
    expect(groups[1]?.count).toBe(2)
    expect(groups[1]?.capacity).toBe(2)
  })

  it("prefers refId over label prefix when present", () => {
    const groups = groupResourcesBySubType([
      resource({ id: "1", label: "Room 1", refId: "supplier-dbl", capacity: 2 }),
      resource({ id: "2", label: "Room 2", refId: "supplier-dbl", capacity: 2 }),
      resource({ id: "3", label: "Room 3", refId: "supplier-sgl", capacity: 1 }),
    ])
    const refKeys = groups.map((g) => g.key)
    expect(refKeys).toContain("ref:supplier-dbl")
    expect(refKeys).toContain("ref:supplier-sgl")
  })

  it("falls back to 'Other' for unlabeled, refId-less resources", () => {
    const groups = groupResourcesBySubType([
      resource({ id: "1", label: null, capacity: 2 }),
      resource({ id: "2", label: "  ", capacity: 1 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.key).toBe("other")
    expect(groups[0]?.count).toBe(2)
  })
})

describe("summarizeResourceCapacity", () => {
  it("flags 'fits' when total resource capacity is under slot pax", () => {
    const summary = summarizeResourceCapacity({
      resources: [resource({ id: "a", capacity: 2 }), resource({ id: "b", capacity: 1 })],
      slotInitialPax: 10,
      slotRemainingPax: 10,
      unlimited: false,
    })
    expect(summary.status).toBe("fits")
    expect(summary.resourceCapacity).toBe(3)
    expect(summary.delta).toBe(-7)
  })

  it("flags 'exact' when resource sum equals slot pax", () => {
    const summary = summarizeResourceCapacity({
      resources: [resource({ id: "a", capacity: 2 }), resource({ id: "b", capacity: 1 })],
      slotInitialPax: 3,
      slotRemainingPax: 3,
      unlimited: false,
    })
    expect(summary.status).toBe("exact")
    expect(summary.delta).toBe(0)
  })

  it("flags 'over' when resource sum exceeds slot pax", () => {
    const summary = summarizeResourceCapacity({
      resources: [resource({ id: "a", capacity: 3 }), resource({ id: "b", capacity: 2 })],
      slotInitialPax: 4,
      slotRemainingPax: 4,
      unlimited: false,
    })
    expect(summary.status).toBe("over")
    expect(summary.delta).toBe(1)
  })

  it("returns 'unbounded' when the slot is unlimited", () => {
    const summary = summarizeResourceCapacity({
      resources: [resource({ id: "a", capacity: 2 })],
      slotInitialPax: 100,
      slotRemainingPax: 100,
      unlimited: true,
    })
    expect(summary.status).toBe("unbounded")
    expect(summary.slotPax).toBeNull()
    expect(summary.delta).toBeNull()
  })

  it("returns 'unbounded' when slot has no initialPax", () => {
    const summary = summarizeResourceCapacity({
      resources: [resource({ id: "a", capacity: 2 })],
      slotInitialPax: null,
      slotRemainingPax: null,
      unlimited: false,
    })
    expect(summary.status).toBe("unbounded")
  })
})

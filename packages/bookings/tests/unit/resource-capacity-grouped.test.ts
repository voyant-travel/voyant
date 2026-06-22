import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"

import { loadResourceCapacityViolations } from "../../src/service.js"
import { BOOKING_RESOURCE_CAPACITY_STATUSES } from "../../src/status.js"

/**
 * Scripted `db.execute` mock. The capacity check must issue exactly:
 *   1. the FOR UPDATE lock on allocation_resources, and
 *   2. ONE grouped count for all checked (kind, resource) pairs —
 * never a COUNT per resource. Call counts are the perf contract here;
 * the SQL itself is covered by tests/integration/resource-capacity.test.ts.
 */
function mockDb(responses: ReadonlyArray<unknown>) {
  let calls = 0
  const queries: unknown[] = []
  const db = {
    execute: async (query: unknown) => {
      queries.push(query)
      const response = responses[calls] ?? []
      calls++
      return response
    },
  }
  return { db: db as PostgresJsDatabase, executeCount: () => calls, queries }
}

const resource = (id: string, kind: string, capacity: number, slotId = "slot_1") => ({
  id,
  kind,
  capacity,
  slot_id: slotId,
})

describe("loadResourceCapacityViolations (grouped count)", () => {
  it("checks all allocation entries with two queries total (lock + one grouped count)", async () => {
    const { db, executeCount, queries } = mockDb([
      // lock query: both resources exist with matching kinds
      [resource("alrs_room1", "room", 2), resource("alrs_bus1", "bus", 40)],
      // grouped count: room is full, bus has plenty of headroom
      [
        { kind: "room", resource_id: "alrs_room1", count: 2 },
        { kind: "bus", resource_id: "alrs_bus1", count: 10 },
      ],
    ])

    const violations = await loadResourceCapacityViolations(db, "trav_x", {
      room: "alrs_room1",
      bus: "alrs_bus1",
    })

    expect(executeCount()).toBe(2)
    const groupedQueryValues = flattenSqlQueryChunks(queries[1])
    for (const status of BOOKING_RESOURCE_CAPACITY_STATUSES) {
      expect(groupedQueryValues).toContain(status)
    }
    expect(groupedQueryValues).not.toContain("pending")
    expect(groupedQueryValues).not.toContain("checked_in")
    expect(violations).toEqual([
      {
        slotId: "slot_1",
        resourceId: "alrs_room1",
        kind: "room",
        capacity: 2,
        existingAssigned: 2,
      },
    ])
  })

  it("treats pairs missing from the grouped result as zero assignments", async () => {
    const { db, executeCount } = mockDb([
      [resource("alrs_room1", "room", 1)],
      // no group row for the pair → nobody is assigned yet
      [],
    ])

    const violations = await loadResourceCapacityViolations(db, "trav_x", {
      room: "alrs_room1",
    })

    expect(executeCount()).toBe(2)
    expect(violations).toEqual([])
  })

  it("reports missing resources and kind mismatches without running the count query", async () => {
    const { db, executeCount } = mockDb([
      // lock query: only the mismatched resource exists (stored kind differs)
      [resource("alrs_cabin1", "cabin", 4)],
    ])

    const violations = await loadResourceCapacityViolations(db, "trav_x", {
      room: "alrs_cabin1", // kind mismatch
      bus: "alrs_ghost", // missing entirely
    })

    // No valid (kind, resource) pair to count → the grouped query is skipped.
    expect(executeCount()).toBe(1)
    expect(violations).toEqual([
      {
        slotId: "slot_1",
        resourceId: "alrs_cabin1",
        kind: "room",
        capacity: 4,
        existingAssigned: 0,
      },
      {
        slotId: "",
        resourceId: "alrs_ghost",
        kind: "bus",
        capacity: 0,
        existingAssigned: 0,
      },
    ])
  })

  it("returns [] without touching the db when allocations are empty", async () => {
    const { db, executeCount } = mockDb([])
    expect(await loadResourceCapacityViolations(db, "trav_x", {})).toEqual([])
    expect(executeCount()).toBe(0)
  })
})

function flattenSqlQueryChunks(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenSqlQueryChunks(entry))
  }

  if (typeof value === "object" && value !== null) {
    if ("queryChunks" in value) {
      return flattenSqlQueryChunks((value as { queryChunks: unknown }).queryChunks)
    }
    if ("value" in value) {
      return flattenSqlQueryChunks((value as { value: unknown }).value)
    }
  }

  return [value]
}

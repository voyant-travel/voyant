import { listResponseSchema } from "@voyant-travel/types"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { __test__ } from "../../../src/routes-groups.js"
import type { BookingGroup, BookingGroupMember } from "../../../src/schema.js"

/**
 * Contract tests for the booking-groups admin wire shapes (voyant#2114).
 * Asserts the authored OpenAPI response row schemas match the serialized wire
 * form (§17 Date→string) via a JSON round-trip, that the canonical
 * `listResponseSchema(...)` envelope wraps the group row, and that the
 * group-detail schema accepts the joined `members` array.
 */

const { bookingGroupSchema, bookingGroupMemberSchema, bookingGroupWithMembersSchema } = __test__

function toWire<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value))
}

const createdAt = new Date("2026-05-15T10:00:00.000Z")
const updatedAt = new Date("2026-05-15T11:00:00.000Z")

const group: BookingGroup = {
  id: "bgr_1",
  kind: "shared_room",
  label: "Room 101",
  primaryBookingId: "bkg_1",
  productId: null,
  optionUnitId: null,
  metadata: { wing: "east" },
  createdAt,
  updatedAt,
}

const member: BookingGroupMember = {
  id: "bgm_1",
  groupId: "bgr_1",
  bookingId: "bkg_1",
  role: "primary",
  createdAt,
}

describe("booking-groups admin contract", () => {
  it("group row schema accepts a serialized row (§17 dates→strings)", () => {
    const parsed = bookingGroupSchema.parse(toWire(group))
    expect(parsed.kind).toBe("shared_room")
    expect(parsed.label).toBe("Room 101")
    expect(typeof parsed.createdAt).toBe("string")
    expect(parsed.metadata).toEqual({ wing: "east" })
    expect(parsed.productId).toBeNull()
  })

  it("member row schema accepts a serialized row", () => {
    const parsed = bookingGroupMemberSchema.parse(toWire(member))
    expect(parsed.role).toBe("primary")
    expect(parsed.bookingId).toBe("bkg_1")
  })

  it("group-detail schema accepts the joined members array", () => {
    const parsed = bookingGroupWithMembersSchema.parse(toWire({ ...group, members: [member] }))
    expect(parsed.members).toHaveLength(1)
    expect(parsed.members[0]?.id).toBe("bgm_1")
  })

  it("wraps group rows in the canonical listResponseSchema envelope", () => {
    const envelope = listResponseSchema(bookingGroupSchema)
    const parsed = envelope.parse(toWire({ data: [group], total: 1, limit: 50, offset: 0 }))
    expect(parsed.data).toHaveLength(1)
    expect(parsed.data[0]?.id).toBe("bgr_1")
    expect(parsed.total).toBe(1)
  })

  it("rejects a group row missing required columns (schema is a real contract)", () => {
    const { id: _omit, ...withoutId } = toWire(group) as Record<string, unknown>
    expect(() => bookingGroupSchema.parse(withoutId)).toThrow(z.ZodError)
  })
})

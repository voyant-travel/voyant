import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  roomBlockPickupRowSchema,
  roomBlockSchema,
  roomBlockSummarySchema,
} from "../../src/routes-room-blocks.js"
import type { roomBlockPickups, roomBlocks } from "../../src/schema-room-blocks.js"
import type { RoomBlockSummary } from "../../src/service-room-blocks.js"

/**
 * Response contract test (voyant#2114) — the room-block admin routes' declared
 * OpenAPI response schemas must match what the service actually returns. The
 * fixtures are typed as the real Drizzle rows (column drift breaks
 * compilation); the JSON round-trip mirrors `c.json` so the `date` / timestamp
 * columns are serialized to strings (§17) before validating against the
 * declared schema. A declared/actual mismatch breaks the test.
 */
const blockRow: InferSelectModel<typeof roomBlocks> = {
  id: "hrbl_0000000000000000000000",
  programId: null,
  supplierId: null,
  propertyId: "place_0000000000000000000000",
  roomTypeId: "hrmt_0000000000000000000000",
  name: "Test Block",
  status: "confirmed",
  currency: "EUR",
  netRateCents: 9000,
  sellRateCents: 12000,
  optionDate: "2026-08-01",
  cutoffDate: "2026-08-15",
  attritionTerms: { allowedShrinkPct: 10 },
  depositTerms: null,
  notes: null,
  metadata: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

const pickupRow: InferSelectModel<typeof roomBlockPickups> = {
  id: "hrbp_0000000000000000000000",
  blockId: blockRow.id,
  bookingId: null,
  stayBookingItemId: null,
  checkIn: "2026-09-01",
  checkOut: "2026-09-03",
  rooms: 2,
  status: "active",
  pickedUpAt: new Date("2026-02-01T00:00:00.000Z"),
  reversedAt: null,
}

const summary: RoomBlockSummary = {
  blockId: blockRow.id,
  status: "confirmed",
  totalHeld: 10,
  totalPickedUp: 4,
  totalReleased: 0,
  totalRemaining: 6,
  pickupProgress: "partial",
}

function roundTrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value))
}

describe("room-block admin response contracts", () => {
  it("the serialized block row satisfies the declared OpenAPI schema", () => {
    const parsed = roomBlockSchema.safeParse(roundTrip(blockRow))
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized pickup ledger row satisfies the declared OpenAPI schema", () => {
    const parsed = roomBlockPickupRowSchema.safeParse(roundTrip(pickupRow))
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized block summary satisfies the declared OpenAPI schema", () => {
    const parsed = roomBlockSummarySchema.safeParse(roundTrip(summary))
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the detail / release envelopes satisfy their declared shapes", () => {
    const detail = z.object({
      data: z.object({ block: roomBlockSchema, summary: roomBlockSummarySchema.nullable() }),
    })
    const release = z.object({
      data: z.object({ releasedRooms: z.number().int(), block: roomBlockSchema }),
    })
    expect(detail.safeParse(roundTrip({ data: { block: blockRow, summary } })).success).toBe(true)
    expect(
      release.safeParse(roundTrip({ data: { releasedRooms: 6, block: blockRow } })).success,
    ).toBe(true)
  })
})

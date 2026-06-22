/**
 * Space-block allotment service — the operations-side consumer of the shared
 * allotment lifecycle (@voyant-travel/allotments). Mirrors the accommodations
 * room-block service: counters maintained in the same transaction as the
 * append-only pickup ledger, row-locked nights, CHECK-guarded oversell.
 * See RFC voyant#1489 §4.2/§4.3.
 */

import {
  allotmentPickupProgress,
  allotmentRemaining,
  eachDateInRange,
  isClosedAllotmentStatus,
  type PickupProgress,
} from "@voyant-travel/allotments"
import { and, eq, inArray, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { functionSpaces } from "./schema-function-spaces.js"
import {
  type SpaceBlock,
  type SpaceBlockPickup,
  spaceBlockPickups,
  spaceBlockSlots,
  spaceBlocks,
} from "./schema-space-blocks.js"

export interface CreateSpaceBlockInput {
  functionSpaceId: string
  name: string
  programId?: string
  supplierId?: string
  currency?: string
  netRateCents?: number
  sellRateCents?: number
  holdStartTime?: string
  holdEndTime?: string
  optionDate?: string
  cutoffDate?: string
  notes?: string
}

export type CreateSpaceBlockOutcome =
  | { status: "ok"; block: SpaceBlock }
  | { status: "function_space_not_found" }

export async function createSpaceBlock(
  db: PostgresJsDatabase,
  input: CreateSpaceBlockInput,
): Promise<CreateSpaceBlockOutcome> {
  const [space] = await db
    .select({ id: functionSpaces.id })
    .from(functionSpaces)
    .where(eq(functionSpaces.id, input.functionSpaceId))
    .limit(1)
  if (!space) return { status: "function_space_not_found" }
  const [block] = await db.insert(spaceBlocks).values(input).returning()
  if (!block) throw new Error("createSpaceBlock: insert returned no rows")
  return { status: "ok", block }
}

export async function getSpaceBlock(
  db: PostgresJsDatabase,
  id: string,
): Promise<SpaceBlock | null> {
  const [block] = await db.select().from(spaceBlocks).where(eq(spaceBlocks.id, id)).limit(1)
  return block ?? null
}

export interface SpaceBlockSlotInput {
  date: string
  unitsHeld: number
  netRateCentsOverride?: number
  sellRateCentsOverride?: number
}

export async function setSpaceBlockSlots(
  db: PostgresJsDatabase,
  blockId: string,
  slots: SpaceBlockSlotInput[],
): Promise<void> {
  if (slots.length === 0) return
  await db
    .insert(spaceBlockSlots)
    .values(slots.map((s) => ({ blockId, ...s })))
    .onConflictDoUpdate({
      target: [spaceBlockSlots.blockId, spaceBlockSlots.date],
      set: {
        unitsHeld: sql`excluded.units_held`,
        netRateCentsOverride: sql`excluded.net_rate_cents_override`,
        sellRateCentsOverride: sql`excluded.sell_rate_cents_override`,
      },
    })
}

export interface SpaceBlockPickupInput {
  blockId: string
  bookingId?: string
  sessionId?: string
  startDate: string
  endDate: string
  units?: number
}

export type SpaceBlockPickupOutcome =
  | { status: "ok"; pickup: SpaceBlockPickup; idempotent: boolean }
  | { status: "invalid_range" }
  | { status: "block_not_found" }
  | { status: "block_not_active" }
  | { status: "slot_unavailable"; date: string; remaining: number; needed: number }

export async function pickupSpaceBlock(
  db: PostgresJsDatabase,
  input: SpaceBlockPickupInput,
): Promise<SpaceBlockPickupOutcome> {
  const units = input.units ?? 1
  const dates = eachDateInRange(input.startDate, input.endDate)
  if (units <= 0 || dates.length === 0) return { status: "invalid_range" }

  return db.transaction(async (tx) => {
    const [block] = await tx
      .select({ id: spaceBlocks.id, status: spaceBlocks.status })
      .from(spaceBlocks)
      .where(eq(spaceBlocks.id, input.blockId))
      .for("update")
      .limit(1)
    if (!block) return { status: "block_not_found" as const }
    if (isClosedAllotmentStatus(block.status)) return { status: "block_not_active" as const }

    if (input.sessionId) {
      const [existing] = await tx
        .select()
        .from(spaceBlockPickups)
        .where(
          and(
            eq(spaceBlockPickups.sessionId, input.sessionId),
            eq(spaceBlockPickups.status, "active"),
          ),
        )
        .limit(1)
      if (existing) return { status: "ok" as const, pickup: existing, idempotent: true }
    }

    const slotRows = await tx
      .select()
      .from(spaceBlockSlots)
      .where(and(eq(spaceBlockSlots.blockId, input.blockId), inArray(spaceBlockSlots.date, dates)))
      .for("update")
    const byDate = new Map(slotRows.map((s) => [s.date, s]))

    for (const date of dates) {
      const slot = byDate.get(date)
      const remaining = slot
        ? allotmentRemaining({
            held: slot.unitsHeld,
            pickedUp: slot.unitsPickedUp,
            released: slot.unitsReleased,
          })
        : 0
      if (!slot || remaining < units) {
        return { status: "slot_unavailable" as const, date, remaining, needed: units }
      }
    }

    for (const date of dates) {
      await tx
        .update(spaceBlockSlots)
        .set({
          // agent-quality: raw-sql reviewed -- owner: operations; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
          unitsPickedUp: sql`${spaceBlockSlots.unitsPickedUp} + ${units}`,
        })
        .where(and(eq(spaceBlockSlots.blockId, input.blockId), eq(spaceBlockSlots.date, date)))
    }

    const [pickup] = await tx
      .insert(spaceBlockPickups)
      .values({
        blockId: input.blockId,
        bookingId: input.bookingId,
        sessionId: input.sessionId,
        startDate: input.startDate,
        endDate: input.endDate,
        units,
      })
      .returning()
    if (!pickup) throw new Error("pickupSpaceBlock: insert returned no rows")
    return { status: "ok" as const, pickup, idempotent: false }
  })
}

export interface SpaceBlockReversalInput {
  /** When set, the pickup must belong to this block or it is treated as not found. */
  blockId?: string
  pickupId?: string
  sessionId?: string
}

export type SpaceBlockReversalOutcome =
  | { status: "ok"; pickup: SpaceBlockPickup }
  | { status: "pickup_not_found" }

export async function reverseSpaceBlockPickup(
  db: PostgresJsDatabase,
  input: SpaceBlockReversalInput,
): Promise<SpaceBlockReversalOutcome> {
  if (!input.pickupId && !input.sessionId) return { status: "pickup_not_found" }

  return db.transaction(async (tx) => {
    const condition = input.pickupId
      ? eq(spaceBlockPickups.id, input.pickupId)
      : and(
          eq(spaceBlockPickups.sessionId, input.sessionId as string),
          eq(spaceBlockPickups.status, "active"),
        )
    const [pickup] = await tx
      .select()
      .from(spaceBlockPickups)
      .where(condition)
      .for("update")
      .limit(1)
    if (!pickup || pickup.status === "reversed") return { status: "pickup_not_found" as const }
    if (input.blockId && pickup.blockId !== input.blockId) {
      return { status: "pickup_not_found" as const }
    }

    for (const date of eachDateInRange(pickup.startDate, pickup.endDate)) {
      await tx
        .update(spaceBlockSlots)
        .set({
          // agent-quality: raw-sql reviewed -- owner: operations; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
          unitsPickedUp: sql`${spaceBlockSlots.unitsPickedUp} - ${pickup.units}`,
        })
        .where(and(eq(spaceBlockSlots.blockId, pickup.blockId), eq(spaceBlockSlots.date, date)))
    }

    const [reversed] = await tx
      .update(spaceBlockPickups)
      .set({ status: "reversed", reversedAt: new Date() })
      .where(eq(spaceBlockPickups.id, pickup.id))
      .returning()
    if (!reversed) throw new Error("reverseSpaceBlockPickup: update returned no rows")
    return { status: "ok" as const, pickup: reversed }
  })
}

export type SpaceBlockCutoffOutcome =
  | { status: "ok"; releasedUnits: number; block: SpaceBlock }
  | { status: "block_not_found" }

export async function releaseSpaceBlockAtCutoff(
  db: PostgresJsDatabase,
  input: { blockId: string },
): Promise<SpaceBlockCutoffOutcome> {
  return db.transaction(async (tx) => {
    const [block] = await tx
      .select()
      .from(spaceBlocks)
      .where(eq(spaceBlocks.id, input.blockId))
      .for("update")
      .limit(1)
    if (!block) return { status: "block_not_found" as const }

    const slotRows = await tx
      .select()
      .from(spaceBlockSlots)
      .where(eq(spaceBlockSlots.blockId, input.blockId))
      .for("update")

    let releasedUnits = 0
    for (const slot of slotRows) {
      const unpicked = slot.unitsHeld - slot.unitsPickedUp - slot.unitsReleased
      if (unpicked <= 0) continue
      releasedUnits += unpicked
      await tx
        .update(spaceBlockSlots)
        .set({ unitsReleased: slot.unitsReleased + unpicked })
        .where(eq(spaceBlockSlots.id, slot.id))
    }

    const [updated] = await tx
      .update(spaceBlocks)
      .set({ status: "released", updatedAt: new Date() })
      .where(eq(spaceBlocks.id, input.blockId))
      .returning()
    if (!updated) throw new Error("releaseSpaceBlockAtCutoff: update returned no rows")
    return { status: "ok" as const, releasedUnits, block: updated }
  })
}

export interface SpaceBlockSummary {
  blockId: string
  status: SpaceBlock["status"]
  totalHeld: number
  totalPickedUp: number
  totalReleased: number
  totalRemaining: number
  pickupProgress: PickupProgress
}

export async function summarizeSpaceBlock(
  db: PostgresJsDatabase,
  blockId: string,
): Promise<SpaceBlockSummary | null> {
  const [block] = await db
    .select({ id: spaceBlocks.id, status: spaceBlocks.status })
    .from(spaceBlocks)
    .where(eq(spaceBlocks.id, blockId))
    .limit(1)
  if (!block) return null

  const slotRows = await db
    .select()
    .from(spaceBlockSlots)
    .where(eq(spaceBlockSlots.blockId, blockId))

  let totalHeld = 0
  let totalPickedUp = 0
  let totalReleased = 0
  for (const s of slotRows) {
    totalHeld += s.unitsHeld
    totalPickedUp += s.unitsPickedUp
    totalReleased += s.unitsReleased
  }
  const counters = { held: totalHeld, pickedUp: totalPickedUp, released: totalReleased }

  return {
    blockId: block.id,
    status: block.status,
    totalHeld,
    totalPickedUp,
    totalReleased,
    totalRemaining: allotmentRemaining(counters),
    pickupProgress: allotmentPickupProgress(counters),
  }
}

export const spaceBlockService = {
  createSpaceBlock,
  getSpaceBlock,
  setSpaceBlockSlots,
  pickupSpaceBlock,
  reverseSpaceBlockPickup,
  releaseSpaceBlockAtCutoff,
  summarizeSpaceBlock,
}

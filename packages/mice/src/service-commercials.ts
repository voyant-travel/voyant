import { roomBlockNights, roomBlocks } from "@voyant-travel/accommodations/schema"
import { spaceBlockSlots, spaceBlocks } from "@voyant-travel/operations"
import { eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { programSessions, sessionInclusions } from "./schema-sessions.js"

/**
 * Consolidated commercials — a program P&L / cost sheet computed on the fly from
 * the program's committed inventory (room blocks, space blocks, session
 * inclusions). No new spine tables (RFC §7 Phase 5): this is a read model that
 * aggregates what the earlier phases already persist.
 *
 * Per category we report contracted exposure (held inventory × net) and the
 * actualized figures on picked-up inventory (cost + sell); program margin is on
 * the actualized (picked) numbers.
 */
export interface CostSheetCategory {
  /** Held inventory × net rate — the contracted exposure. */
  contractedCostCents: number
  /** Picked-up inventory × net rate — realized cost. */
  pickedCostCents: number
  /** Picked-up inventory × sell rate — realized revenue. */
  pickedSellCents: number
}

export interface ProgramCostSheet {
  programId: string
  roomBlocks: CostSheetCategory
  spaceBlocks: CostSheetCategory
  sessionInclusionsCostCents: number
  totals: {
    costCents: number
    sellCents: number
    marginCents: number
    /** Margin as a % of sell, or null when there is no realized revenue yet. */
    marginPct: number | null
  }
}

const emptyCategory = (): CostSheetCategory => ({
  contractedCostCents: 0,
  pickedCostCents: 0,
  pickedSellCents: 0,
})

export async function getProgramCostSheet(
  db: PostgresJsDatabase,
  programId: string,
): Promise<ProgramCostSheet> {
  const roomCat = emptyCategory()
  const spaceCat = emptyCategory()

  // ── Room blocks (accommodations) ──
  const rBlocks = await db
    .select({ id: roomBlocks.id, net: roomBlocks.netRateCents, sell: roomBlocks.sellRateCents })
    .from(roomBlocks)
    .where(eq(roomBlocks.programId, programId))
  if (rBlocks.length) {
    const rateById = new Map(rBlocks.map((b) => [b.id, { net: b.net ?? 0, sell: b.sell ?? 0 }]))
    const nights = await db
      .select()
      .from(roomBlockNights)
      .where(
        inArray(
          roomBlockNights.blockId,
          rBlocks.map((b) => b.id),
        ),
      )
    for (const n of nights) {
      const rate = rateById.get(n.blockId) ?? { net: 0, sell: 0 }
      const net = n.netRateCentsOverride ?? rate.net
      const sell = n.sellRateCentsOverride ?? rate.sell
      roomCat.contractedCostCents += n.roomsHeld * net
      roomCat.pickedCostCents += n.roomsPickedUp * net
      roomCat.pickedSellCents += n.roomsPickedUp * sell
    }
  }

  // ── Space blocks (operations) ──
  const sBlocks = await db
    .select({ id: spaceBlocks.id, net: spaceBlocks.netRateCents, sell: spaceBlocks.sellRateCents })
    .from(spaceBlocks)
    .where(eq(spaceBlocks.programId, programId))
  if (sBlocks.length) {
    const rateById = new Map(sBlocks.map((b) => [b.id, { net: b.net ?? 0, sell: b.sell ?? 0 }]))
    const slots = await db
      .select()
      .from(spaceBlockSlots)
      .where(
        inArray(
          spaceBlockSlots.blockId,
          sBlocks.map((b) => b.id),
        ),
      )
    for (const s of slots) {
      const rate = rateById.get(s.blockId) ?? { net: 0, sell: 0 }
      const net = s.netRateCentsOverride ?? rate.net
      const sell = s.sellRateCentsOverride ?? rate.sell
      spaceCat.contractedCostCents += s.unitsHeld * net
      spaceCat.pickedCostCents += s.unitsPickedUp * net
      spaceCat.pickedSellCents += s.unitsPickedUp * sell
    }
  }

  // ── Session inclusions (mice) ──
  let sessionInclusionsCostCents = 0
  const sessions = await db
    .select({ id: programSessions.id })
    .from(programSessions)
    .where(eq(programSessions.programId, programId))
  if (sessions.length) {
    const inclusions = await db
      .select({ qty: sessionInclusions.quantity, cost: sessionInclusions.costAmountCents })
      .from(sessionInclusions)
      .where(
        inArray(
          sessionInclusions.sessionId,
          sessions.map((s) => s.id),
        ),
      )
    for (const i of inclusions) sessionInclusionsCostCents += i.qty * (i.cost ?? 0)
  }

  const costCents = roomCat.pickedCostCents + spaceCat.pickedCostCents + sessionInclusionsCostCents
  const sellCents = roomCat.pickedSellCents + spaceCat.pickedSellCents
  const marginCents = sellCents - costCents

  return {
    programId,
    roomBlocks: roomCat,
    spaceBlocks: spaceCat,
    sessionInclusionsCostCents,
    totals: {
      costCents,
      sellCents,
      marginCents,
      marginPct: sellCents > 0 ? Math.round((marginCents / sellCents) * 1000) / 10 : null,
    },
  }
}

export const commercialsService = { getProgramCostSheet }

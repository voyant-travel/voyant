import { roomBlockNights, roomBlocks } from "@voyant-travel/accommodations/schema"
import { spaceBlockSlots, spaceBlocks } from "@voyant-travel/operations"
import { eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { programs } from "./schema.js"
import { programSessions, sessionInclusions } from "./schema-sessions.js"

/**
 * Consolidated commercials — a program P&L / cost sheet computed on the fly from
 * the program's committed inventory (room blocks, space blocks, session
 * inclusions). No new spine tables (RFC §7 Phase 5): a read model over what
 * Phases 1–4 persist.
 *
 * Each source carries its own currency, so totals are GROUPED BY CURRENCY — no
 * FX conversion is assumed. `mixedCurrency` flags programs spanning more than
 * one. Amounts whose source row has no currency fall back to the program
 * currency, or `UNSPECIFIED` when the program has none either.
 *
 * Per category: contracted exposure (held × net) and the actualized figures on
 * picked-up inventory (cost + sell); margin is on the actualized numbers.
 */
export interface CostSheetCategory {
  contractedCostCents: number
  pickedCostCents: number
  pickedSellCents: number
}

export interface CostSheetCurrencyTotals {
  currency: string
  roomBlocks: CostSheetCategory
  spaceBlocks: CostSheetCategory
  sessionInclusionsCostCents: number
  costCents: number
  sellCents: number
  marginCents: number
  /** Margin as a % of sell, or null when there is no realized revenue yet. */
  marginPct: number | null
}

export interface ProgramCostSheet {
  programId: string
  mixedCurrency: boolean
  /** One entry per currency present, sorted by currency code. */
  byCurrency: CostSheetCurrencyTotals[]
}

const UNSPECIFIED = "UNSPECIFIED"

interface Bucket {
  roomBlocks: CostSheetCategory
  spaceBlocks: CostSheetCategory
  sessionInclusionsCostCents: number
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
  const [program] = await db
    .select({ currency: programs.currency })
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1)
  const fallbackCurrency = program?.currency ?? UNSPECIFIED

  const buckets = new Map<string, Bucket>()
  const bucketFor = (currency: string): Bucket => {
    let b = buckets.get(currency)
    if (!b) {
      b = {
        roomBlocks: emptyCategory(),
        spaceBlocks: emptyCategory(),
        sessionInclusionsCostCents: 0,
      }
      buckets.set(currency, b)
    }
    return b
  }

  // ── Room blocks (accommodations) — currency is required on the block. ──
  const rBlocks = await db
    .select({
      id: roomBlocks.id,
      net: roomBlocks.netRateCents,
      sell: roomBlocks.sellRateCents,
      currency: roomBlocks.currency,
    })
    .from(roomBlocks)
    .where(eq(roomBlocks.programId, programId))
  if (rBlocks.length) {
    const byId = new Map(rBlocks.map((b) => [b.id, b]))
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
      const block = byId.get(n.blockId)
      if (!block) continue
      const cat = bucketFor(block.currency ?? fallbackCurrency).roomBlocks
      const net = n.netRateCentsOverride ?? block.net ?? 0
      const sell = n.sellRateCentsOverride ?? block.sell ?? 0
      cat.contractedCostCents += n.roomsHeld * net
      cat.pickedCostCents += n.roomsPickedUp * net
      cat.pickedSellCents += n.roomsPickedUp * sell
    }
  }

  // ── Space blocks (operations) — currency nullable. ──
  const sBlocks = await db
    .select({
      id: spaceBlocks.id,
      net: spaceBlocks.netRateCents,
      sell: spaceBlocks.sellRateCents,
      currency: spaceBlocks.currency,
    })
    .from(spaceBlocks)
    .where(eq(spaceBlocks.programId, programId))
  if (sBlocks.length) {
    const byId = new Map(sBlocks.map((b) => [b.id, b]))
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
      const block = byId.get(s.blockId)
      if (!block) continue
      const cat = bucketFor(block.currency ?? fallbackCurrency).spaceBlocks
      const net = s.netRateCentsOverride ?? block.net ?? 0
      const sell = s.sellRateCentsOverride ?? block.sell ?? 0
      cat.contractedCostCents += s.unitsHeld * net
      cat.pickedCostCents += s.unitsPickedUp * net
      cat.pickedSellCents += s.unitsPickedUp * sell
    }
  }

  // ── Session inclusions (mice) — currency nullable, cost only. ──
  const sessions = await db
    .select({ id: programSessions.id })
    .from(programSessions)
    .where(eq(programSessions.programId, programId))
  if (sessions.length) {
    const inclusions = await db
      .select({
        qty: sessionInclusions.quantity,
        cost: sessionInclusions.costAmountCents,
        currency: sessionInclusions.currency,
      })
      .from(sessionInclusions)
      .where(
        inArray(
          sessionInclusions.sessionId,
          sessions.map((s) => s.id),
        ),
      )
    for (const i of inclusions) {
      bucketFor(i.currency ?? fallbackCurrency).sessionInclusionsCostCents += i.qty * (i.cost ?? 0)
    }
  }

  const byCurrency: CostSheetCurrencyTotals[] = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, b]) => {
      const costCents =
        b.roomBlocks.pickedCostCents + b.spaceBlocks.pickedCostCents + b.sessionInclusionsCostCents
      const sellCents = b.roomBlocks.pickedSellCents + b.spaceBlocks.pickedSellCents
      const marginCents = sellCents - costCents
      return {
        currency,
        roomBlocks: b.roomBlocks,
        spaceBlocks: b.spaceBlocks,
        sessionInclusionsCostCents: b.sessionInclusionsCostCents,
        costCents,
        sellCents,
        marginCents,
        marginPct: sellCents > 0 ? Math.round((marginCents / sellCents) * 1000) / 10 : null,
      }
    })

  return { programId, mixedCurrency: byCurrency.length > 1, byCurrency }
}

export const commercialsService = { getProgramCostSheet }

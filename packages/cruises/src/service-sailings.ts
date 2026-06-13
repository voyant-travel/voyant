import { and, asc, count, eq, gte, inArray, lte } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { CruiseSailing, NewCruiseSailing } from "./schema-core.js"
import { cruiseSailings } from "./schema-core.js"
import type { CruiseDay, CruiseSailingDay } from "./schema-itinerary.js"
import { cruiseDays, cruiseSailingDays } from "./schema-itinerary.js"
import type { CruisePrice, CruisePriceComponent } from "./schema-pricing.js"
import { cruisePriceComponents, cruisePrices } from "./schema-pricing.js"
import { type EffectiveItineraryDay, mergeDay } from "./service-itinerary.js"
import { paginate, reprojectIfPossible, setUpdated } from "./service-shared.js"
import type { InsertSailing, SailingListQuery, UpdateSailing } from "./validation-core.js"
import type { ReplaceCruiseDays, ReplaceSailingDays } from "./validation-itinerary.js"

export const cruiseSailingsService = {
  async listSailings(db: PostgresJsDatabase, query: SailingListQuery) {
    const conditions = []
    if (query.cruiseId) conditions.push(eq(cruiseSailings.cruiseId, query.cruiseId))
    if (query.shipId) conditions.push(eq(cruiseSailings.shipId, query.shipId))
    if (query.salesStatus) conditions.push(eq(cruiseSailings.salesStatus, query.salesStatus))
    if (query.dateFrom) conditions.push(gte(cruiseSailings.departureDate, query.dateFrom))
    if (query.dateTo) conditions.push(lte(cruiseSailings.departureDate, query.dateTo))
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const { limit, offset } = paginate(query)

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(cruiseSailings)
        .where(where)
        .orderBy(asc(cruiseSailings.departureDate))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(cruiseSailings).where(where),
    ])
    return { data: rows, total: totalRows[0]?.value ?? 0, limit, offset }
  },

  async getSailingById(
    db: PostgresJsDatabase,
    id: string,
    options: { withPricing?: boolean; withItinerary?: boolean } = {},
  ): Promise<
    | (CruiseSailing & {
        prices?: CruisePrice[]
        priceComponents?: CruisePriceComponent[]
        effectiveDays?: EffectiveItineraryDay[]
      })
    | null
  > {
    const [row] = await db.select().from(cruiseSailings).where(eq(cruiseSailings.id, id)).limit(1)
    if (!row) return null

    const out: CruiseSailing & {
      prices?: CruisePrice[]
      priceComponents?: CruisePriceComponent[]
      effectiveDays?: EffectiveItineraryDay[]
    } = { ...row }

    if (options.withPricing) {
      const prices = await db
        .select()
        .from(cruisePrices)
        .where(eq(cruisePrices.sailingId, id))
        .orderBy(asc(cruisePrices.cabinCategoryId), asc(cruisePrices.occupancy))
      out.prices = prices
      if (prices.length > 0) {
        const priceIds = prices.map((p) => p.id)
        out.priceComponents = await db
          .select()
          .from(cruisePriceComponents)
          .where(inArray(cruisePriceComponents.priceId, priceIds))
      } else {
        out.priceComponents = []
      }
    }

    if (options.withItinerary) {
      out.effectiveDays = await this.getEffectiveItinerary(db, id)
    }
    return out
  },

  async upsertSailing(db: PostgresJsDatabase, data: InsertSailing): Promise<CruiseSailing> {
    const [existing] = await db
      .select()
      .from(cruiseSailings)
      .where(
        and(
          eq(cruiseSailings.cruiseId, data.cruiseId),
          eq(cruiseSailings.departureDate, data.departureDate),
          eq(cruiseSailings.shipId, data.shipId),
        ),
      )
      .limit(1)

    if (existing) {
      const [row] = await db
        .update(cruiseSailings)
        .set({ ...data, ...setUpdated, lastSyncedAt: new Date() } as Partial<NewCruiseSailing>)
        .where(eq(cruiseSailings.id, existing.id))
        .returning()
      if (!row) throw new Error("Failed to update sailing")
      await reprojectIfPossible(db, row.cruiseId)
      return row
    }

    const [row] = await db
      .insert(cruiseSailings)
      .values({ ...data, lastSyncedAt: new Date() } as NewCruiseSailing)
      .returning()
    if (!row) throw new Error("Failed to insert sailing")
    await reprojectIfPossible(db, row.cruiseId)
    return row
  },

  async updateSailing(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateSailing,
  ): Promise<CruiseSailing | null> {
    const [row] = await db
      .update(cruiseSailings)
      .set({ ...data, ...setUpdated })
      .where(eq(cruiseSailings.id, id))
      .returning()
    if (row) await reprojectIfPossible(db, row.cruiseId)
    return row ?? null
  },

  // ---------- itinerary ----------

  async getEffectiveItinerary(
    db: PostgresJsDatabase,
    sailingId: string,
  ): Promise<EffectiveItineraryDay[]> {
    const [sailing] = await db
      .select({ cruiseId: cruiseSailings.cruiseId })
      .from(cruiseSailings)
      .where(eq(cruiseSailings.id, sailingId))
      .limit(1)
    if (!sailing) return []

    const [baseDays, overrides] = await Promise.all([
      db
        .select()
        .from(cruiseDays)
        .where(eq(cruiseDays.cruiseId, sailing.cruiseId))
        .orderBy(asc(cruiseDays.dayNumber)),
      db.select().from(cruiseSailingDays).where(eq(cruiseSailingDays.sailingId, sailingId)),
    ])

    const overrideByDay = new Map<number, CruiseSailingDay>()
    for (const o of overrides) overrideByDay.set(o.dayNumber, o)

    return baseDays.map(
      (day): EffectiveItineraryDay => mergeDay(day, overrideByDay.get(day.dayNumber)),
    )
  },

  async replaceCruiseDays(
    db: PostgresJsDatabase,
    payload: ReplaceCruiseDays,
  ): Promise<CruiseDay[]> {
    return db.transaction(async (tx) => {
      await tx.delete(cruiseDays).where(eq(cruiseDays.cruiseId, payload.cruiseId))
      if (payload.days.length === 0) return []
      const inserted = await tx
        .insert(cruiseDays)
        .values(payload.days.map((d) => ({ ...d, cruiseId: payload.cruiseId })))
        .returning()
      return inserted
    })
  },

  async replaceSailingDays(
    db: PostgresJsDatabase,
    payload: ReplaceSailingDays,
  ): Promise<CruiseSailingDay[]> {
    return db.transaction(async (tx) => {
      await tx.delete(cruiseSailingDays).where(eq(cruiseSailingDays.sailingId, payload.sailingId))
      if (payload.days.length === 0) return []
      const inserted = await tx
        .insert(cruiseSailingDays)
        .values(payload.days.map((d) => ({ ...d, sailingId: payload.sailingId })))
        .returning()
      return inserted
    })
  },

  // ---------- ships, decks, cabin categories, cabins ----------
}

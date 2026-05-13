import type { EventBus } from "@voyantjs/core"
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  CRUISE_CREATED_EVENT,
  CRUISE_DELETED_EVENT,
  CRUISE_UPDATED_EVENT,
  emitCruiseLifecycleEvent,
} from "./events.js"
import {
  type CruiseCabin,
  type CruiseCabinCategory,
  type CruiseDeck,
  type CruiseShip,
  cruiseCabinCategories,
  cruiseCabins,
  cruiseDecks,
  cruiseShips,
} from "./schema-cabins.js"
import { type CruiseEnrichmentProgram, cruiseEnrichmentPrograms } from "./schema-content.js"
import {
  type Cruise,
  type CruiseSailing,
  cruiseSailings,
  cruises,
  type NewCruise,
  type NewCruiseSailing,
} from "./schema-core.js"
import {
  type CruiseDay,
  type CruiseSailingDay,
  cruiseDays,
  cruiseSailingDays,
} from "./schema-itinerary.js"
import {
  type CruisePrice,
  type CruisePriceComponent,
  cruisePriceComponents,
  cruisePrices,
  type NewCruisePrice,
  type NewCruisePriceComponent,
} from "./schema-pricing.js"
import type {
  InsertCabin,
  InsertCabinCategory,
  InsertDeck,
  InsertShip,
  ShipListQuery,
  UpdateCabin,
  UpdateCabinCategory,
  UpdateDeck,
  UpdateShip,
} from "./validation-cabins.js"
import type {
  InsertEnrichmentProgram,
  ReplaceEnrichmentPrograms,
  UpdateEnrichmentProgram,
} from "./validation-content.js"
import type {
  CruiseListQuery,
  InsertCruise,
  InsertSailing,
  SailingListQuery,
  UpdateCruise,
  UpdateSailing,
} from "./validation-core.js"
import type { ReplaceCruiseDays, ReplaceSailingDays } from "./validation-itinerary.js"
import type {
  InsertPrice,
  InsertPriceComponent,
  PriceListQuery,
  UpdatePrice,
} from "./validation-pricing.js"

// ---------- helpers ----------

const setUpdated = { updatedAt: new Date() }

function paginate(query: { limit: number; offset: number }) {
  return { limit: query.limit, offset: query.offset }
}

export interface CruiseMutationRuntime {
  eventBus?: EventBus
}

/**
 * Re-project a cruise into cruise_search_index after a mutation. Errors are
 * swallowed and logged — the search index is best-effort, never a barrier to
 * the underlying mutation succeeding. Operators with no storefront never see
 * an effect either way.
 *
 * Uses a dynamic import to avoid the circular dep between service.ts (which
 * holds the canonical operations) and service-search.ts (which reads from the
 * canonical tables to compute aggregates).
 */
async function reprojectIfPossible(db: PostgresJsDatabase, cruiseId: string | null): Promise<void> {
  if (!cruiseId) return
  try {
    const { cruisesSearchService } = await import("./service-search.js")
    await cruisesSearchService.projectLocalCruise(db, cruiseId)
  } catch (err) {
    // Don't crash the caller — log and move on. Operators can run the
    // POST /v1/admin/cruises/search-index/rebuild endpoint to repair drift.
    // eslint-disable-next-line no-console
    console.warn(`[cruises] search-index projection failed for ${cruiseId}:`, err)
  }
}

// ---------- cruises ----------

export const cruisesService = {
  async listCruises(db: PostgresJsDatabase, query: CruiseListQuery) {
    const conditions = []
    if (query.cruiseType) conditions.push(eq(cruises.cruiseType, query.cruiseType))
    if (query.status) conditions.push(eq(cruises.status, query.status))
    if (query.lineSupplierId) conditions.push(eq(cruises.lineSupplierId, query.lineSupplierId))
    if (query.region) {
      conditions.push(sql`${cruises.regions} @> ${JSON.stringify([query.region])}::jsonb`)
    }
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(cruises.name, term), ilike(cruises.description, term)))
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const { limit, offset } = paginate(query)

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(cruises)
        .where(where)
        .orderBy(desc(cruises.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(cruises).where(where),
    ])
    return { data: rows, total: totalRows[0]?.value ?? 0, limit, offset }
  },

  async getCruiseById(
    db: PostgresJsDatabase,
    id: string,
    options: { withSailings?: boolean; withDays?: boolean } = {},
  ): Promise<
    | (Cruise & {
        sailings?: CruiseSailing[]
        days?: CruiseDay[]
      })
    | null
  > {
    const [row] = await db.select().from(cruises).where(eq(cruises.id, id)).limit(1)
    if (!row) return null

    const out: Cruise & { sailings?: CruiseSailing[]; days?: CruiseDay[] } = { ...row }
    if (options.withSailings) {
      out.sailings = await db
        .select()
        .from(cruiseSailings)
        .where(eq(cruiseSailings.cruiseId, id))
        .orderBy(asc(cruiseSailings.departureDate))
    }
    if (options.withDays) {
      out.days = await db
        .select()
        .from(cruiseDays)
        .where(eq(cruiseDays.cruiseId, id))
        .orderBy(asc(cruiseDays.dayNumber))
    }
    return out
  },

  async createCruise(
    db: PostgresJsDatabase,
    data: InsertCruise,
    runtime: CruiseMutationRuntime = {},
  ): Promise<Cruise> {
    const [row] = await db
      .insert(cruises)
      .values(data as NewCruise)
      .returning()
    if (!row) throw new Error("Failed to create cruise")
    await reprojectIfPossible(db, row.id)
    await emitCruiseLifecycleEvent(runtime.eventBus, CRUISE_CREATED_EVENT, { id: row.id })
    return row
  },

  async updateCruise(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateCruise,
    runtime: CruiseMutationRuntime = {},
  ): Promise<Cruise | null> {
    const [row] = await db
      .update(cruises)
      .set({ ...data, ...setUpdated })
      .where(eq(cruises.id, id))
      .returning()
    if (row) {
      await reprojectIfPossible(db, row.id)
      await emitCruiseLifecycleEvent(runtime.eventBus, CRUISE_UPDATED_EVENT, { id: row.id })
    }
    return row ?? null
  },

  async archiveCruise(
    db: PostgresJsDatabase,
    id: string,
    runtime: CruiseMutationRuntime = {},
  ): Promise<Cruise | null> {
    const [row] = await db
      .update(cruises)
      .set({ status: "archived", ...setUpdated })
      .where(eq(cruises.id, id))
      .returning()
    if (row) {
      await reprojectIfPossible(db, row.id)
      await emitCruiseLifecycleEvent(runtime.eventBus, CRUISE_DELETED_EVENT, { id: row.id })
    }
    return row ?? null
  },

  async recomputeCruiseAggregates(
    db: PostgresJsDatabase,
    cruiseId: string,
  ): Promise<Cruise | null> {
    // Lowest available price across all of this cruise's sailings × cabin categories × occupancies.
    const [priceAgg] = await db
      .select({
        lowest: sql<string | null>`MIN(${cruisePrices.pricePerPerson}::numeric)::text`,
        currency: sql<
          string | null
        >`(ARRAY_AGG(${cruisePrices.currency} ORDER BY ${cruisePrices.pricePerPerson}::numeric ASC))[1]`,
      })
      .from(cruisePrices)
      .innerJoin(cruiseSailings, eq(cruisePrices.sailingId, cruiseSailings.id))
      .where(
        and(eq(cruiseSailings.cruiseId, cruiseId), sql`${cruisePrices.availability} <> 'sold_out'`),
      )

    const [dateAgg] = await db
      .select({
        earliest: sql<string | null>`MIN(${cruiseSailings.departureDate})`,
        latest: sql<string | null>`MAX(${cruiseSailings.departureDate})`,
      })
      .from(cruiseSailings)
      .where(eq(cruiseSailings.cruiseId, cruiseId))

    const [row] = await db
      .update(cruises)
      .set({
        lowestPriceCached: priceAgg?.lowest ?? null,
        lowestPriceCurrencyCached: priceAgg?.currency ?? null,
        earliestDepartureCached: dateAgg?.earliest ?? null,
        latestDepartureCached: dateAgg?.latest ?? null,
        ...setUpdated,
      })
      .where(eq(cruises.id, cruiseId))
      .returning()
    if (row) await reprojectIfPossible(db, row.id)
    return row ?? null
  },

  // ---------- sailings ----------

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

  async listShips(db: PostgresJsDatabase, query: ShipListQuery) {
    const conditions = []
    if (query.lineSupplierId) conditions.push(eq(cruiseShips.lineSupplierId, query.lineSupplierId))
    if (query.shipType) conditions.push(eq(cruiseShips.shipType, query.shipType))
    if (typeof query.isActive === "boolean")
      conditions.push(eq(cruiseShips.isActive, query.isActive))
    if (query.search) conditions.push(ilike(cruiseShips.name, `%${query.search}%`))
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const { limit, offset } = paginate(query)

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(cruiseShips)
        .where(where)
        .orderBy(asc(cruiseShips.name))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(cruiseShips).where(where),
    ])
    return { data: rows, total: totalRows[0]?.value ?? 0, limit, offset }
  },

  async getShipById(db: PostgresJsDatabase, id: string): Promise<CruiseShip | null> {
    const [row] = await db.select().from(cruiseShips).where(eq(cruiseShips.id, id)).limit(1)
    return row ?? null
  },

  async createShip(db: PostgresJsDatabase, data: InsertShip): Promise<CruiseShip> {
    const [row] = await db.insert(cruiseShips).values(data).returning()
    if (!row) throw new Error("Failed to create ship")
    return row
  },

  async updateShip(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateShip,
  ): Promise<CruiseShip | null> {
    const [row] = await db
      .update(cruiseShips)
      .set({ ...data, ...setUpdated })
      .where(eq(cruiseShips.id, id))
      .returning()
    return row ?? null
  },

  async listShipDecks(db: PostgresJsDatabase, shipId: string): Promise<CruiseDeck[]> {
    return db
      .select()
      .from(cruiseDecks)
      .where(eq(cruiseDecks.shipId, shipId))
      .orderBy(asc(cruiseDecks.level))
  },

  async upsertDeck(db: PostgresJsDatabase, data: InsertDeck): Promise<CruiseDeck> {
    const [existing] = await db
      .select()
      .from(cruiseDecks)
      .where(and(eq(cruiseDecks.shipId, data.shipId), eq(cruiseDecks.name, data.name)))
      .limit(1)
    if (existing) {
      const [row] = await db
        .update(cruiseDecks)
        .set({ ...data, ...setUpdated })
        .where(eq(cruiseDecks.id, existing.id))
        .returning()
      if (!row) throw new Error("Failed to update deck")
      return row
    }
    const [row] = await db.insert(cruiseDecks).values(data).returning()
    if (!row) throw new Error("Failed to insert deck")
    return row
  },

  async updateDeck(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateDeck,
  ): Promise<CruiseDeck | null> {
    const [row] = await db
      .update(cruiseDecks)
      .set({ ...data, ...setUpdated })
      .where(eq(cruiseDecks.id, id))
      .returning()
    return row ?? null
  },

  async listShipCabinCategories(
    db: PostgresJsDatabase,
    shipId: string,
  ): Promise<CruiseCabinCategory[]> {
    return db
      .select()
      .from(cruiseCabinCategories)
      .where(eq(cruiseCabinCategories.shipId, shipId))
      .orderBy(asc(cruiseCabinCategories.code))
  },

  async upsertCabinCategory(
    db: PostgresJsDatabase,
    data: InsertCabinCategory,
  ): Promise<CruiseCabinCategory> {
    const [existing] = await db
      .select()
      .from(cruiseCabinCategories)
      .where(
        and(
          eq(cruiseCabinCategories.shipId, data.shipId),
          eq(cruiseCabinCategories.code, data.code),
        ),
      )
      .limit(1)
    if (existing) {
      const [row] = await db
        .update(cruiseCabinCategories)
        .set({ ...data, ...setUpdated })
        .where(eq(cruiseCabinCategories.id, existing.id))
        .returning()
      if (!row) throw new Error("Failed to update cabin category")
      return row
    }
    const [row] = await db.insert(cruiseCabinCategories).values(data).returning()
    if (!row) throw new Error("Failed to insert cabin category")
    return row
  },

  async updateCabinCategory(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateCabinCategory,
  ): Promise<CruiseCabinCategory | null> {
    const [row] = await db
      .update(cruiseCabinCategories)
      .set({ ...data, ...setUpdated })
      .where(eq(cruiseCabinCategories.id, id))
      .returning()
    return row ?? null
  },

  async listCabinsByCategory(db: PostgresJsDatabase, categoryId: string): Promise<CruiseCabin[]> {
    return db
      .select()
      .from(cruiseCabins)
      .where(eq(cruiseCabins.categoryId, categoryId))
      .orderBy(asc(cruiseCabins.cabinNumber))
  },

  async upsertCabin(db: PostgresJsDatabase, data: InsertCabin): Promise<CruiseCabin> {
    const [existing] = await db
      .select()
      .from(cruiseCabins)
      .where(
        and(
          eq(cruiseCabins.categoryId, data.categoryId),
          eq(cruiseCabins.cabinNumber, data.cabinNumber),
        ),
      )
      .limit(1)
    if (existing) {
      const [row] = await db
        .update(cruiseCabins)
        .set({ ...data, ...setUpdated })
        .where(eq(cruiseCabins.id, existing.id))
        .returning()
      if (!row) throw new Error("Failed to update cabin")
      return row
    }
    const [row] = await db.insert(cruiseCabins).values(data).returning()
    if (!row) throw new Error("Failed to insert cabin")
    return row
  },

  async updateCabin(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateCabin,
  ): Promise<CruiseCabin | null> {
    const [row] = await db
      .update(cruiseCabins)
      .set({ ...data, ...setUpdated })
      .where(eq(cruiseCabins.id, id))
      .returning()
    return row ?? null
  },

  // ---------- prices ----------

  async listPrices(db: PostgresJsDatabase, query: PriceListQuery) {
    const conditions = []
    if (query.sailingId) conditions.push(eq(cruisePrices.sailingId, query.sailingId))
    if (query.cabinCategoryId)
      conditions.push(eq(cruisePrices.cabinCategoryId, query.cabinCategoryId))
    if (query.occupancy) conditions.push(eq(cruisePrices.occupancy, query.occupancy))
    if (query.fareCode) conditions.push(eq(cruisePrices.fareCode, query.fareCode))
    if (query.availability) conditions.push(eq(cruisePrices.availability, query.availability))
    if (query.priceCatalogId) conditions.push(eq(cruisePrices.priceCatalogId, query.priceCatalogId))
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const { limit, offset } = paginate(query)

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(cruisePrices)
        .where(where)
        .orderBy(asc(cruisePrices.cabinCategoryId), asc(cruisePrices.occupancy))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(cruisePrices).where(where),
    ])
    return { data: rows, total: totalRows[0]?.value ?? 0, limit, offset }
  },

  async createPrice(db: PostgresJsDatabase, data: InsertPrice): Promise<CruisePrice> {
    const [row] = await db
      .insert(cruisePrices)
      .values({ ...data, lastSyncedAt: new Date() } as NewCruisePrice)
      .returning()
    if (!row) throw new Error("Failed to create price")
    return row
  },

  async updatePrice(
    db: PostgresJsDatabase,
    id: string,
    data: UpdatePrice,
  ): Promise<CruisePrice | null> {
    const [row] = await db
      .update(cruisePrices)
      .set({ ...data, ...setUpdated })
      .where(eq(cruisePrices.id, id))
      .returning()
    return row ?? null
  },

  async replaceSailingPricing(
    db: PostgresJsDatabase,
    sailingId: string,
    payload: {
      prices: Array<InsertPrice & { components?: Array<Omit<InsertPriceComponent, "priceId">> }>
    },
  ): Promise<CruisePrice[]> {
    const result = await db.transaction(async (tx) => {
      // Cascade-delete existing prices for this sailing — components go with them via FK.
      await tx.delete(cruisePrices).where(eq(cruisePrices.sailingId, sailingId))

      if (payload.prices.length === 0) return []

      const insertedPrices: CruisePrice[] = []
      for (const p of payload.prices) {
        const { components, ...priceFields } = p
        const [priceRow] = await tx
          .insert(cruisePrices)
          .values({ ...priceFields, sailingId, lastSyncedAt: new Date() } as NewCruisePrice)
          .returning()
        if (!priceRow) throw new Error("Failed to insert price")
        insertedPrices.push(priceRow)

        if (components && components.length > 0) {
          await tx
            .insert(cruisePriceComponents)
            .values(
              components.map((c): NewCruisePriceComponent => ({ ...c, priceId: priceRow.id })),
            )
        }
      }
      return insertedPrices
    })

    // Bulk pricing changes likely move the lowest-price aggregate. Re-project
    // the parent cruise so the storefront index stays current.
    const [sailing] = await db
      .select({ cruiseId: cruiseSailings.cruiseId })
      .from(cruiseSailings)
      .where(eq(cruiseSailings.id, sailingId))
      .limit(1)
    if (sailing) await reprojectIfPossible(db, sailing.cruiseId)

    return result
  },

  // ---------- enrichment programs (expedition-focused) ----------

  async listEnrichmentPrograms(
    db: PostgresJsDatabase,
    cruiseId: string,
  ): Promise<CruiseEnrichmentProgram[]> {
    return db
      .select()
      .from(cruiseEnrichmentPrograms)
      .where(eq(cruiseEnrichmentPrograms.cruiseId, cruiseId))
      .orderBy(asc(cruiseEnrichmentPrograms.sortOrder), asc(cruiseEnrichmentPrograms.name))
  },

  async createEnrichmentProgram(
    db: PostgresJsDatabase,
    data: InsertEnrichmentProgram,
  ): Promise<CruiseEnrichmentProgram> {
    const [row] = await db.insert(cruiseEnrichmentPrograms).values(data).returning()
    if (!row) throw new Error("Failed to create enrichment program")
    return row
  },

  async updateEnrichmentProgram(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateEnrichmentProgram,
  ): Promise<CruiseEnrichmentProgram | null> {
    const [row] = await db
      .update(cruiseEnrichmentPrograms)
      .set({ ...data, ...setUpdated })
      .where(eq(cruiseEnrichmentPrograms.id, id))
      .returning()
    return row ?? null
  },

  async deleteEnrichmentProgram(db: PostgresJsDatabase, id: string): Promise<boolean> {
    const result = await db
      .delete(cruiseEnrichmentPrograms)
      .where(eq(cruiseEnrichmentPrograms.id, id))
      .returning({ id: cruiseEnrichmentPrograms.id })
    return result.length > 0
  },

  async replaceEnrichmentPrograms(
    db: PostgresJsDatabase,
    payload: ReplaceEnrichmentPrograms,
  ): Promise<CruiseEnrichmentProgram[]> {
    return db.transaction(async (tx) => {
      await tx
        .delete(cruiseEnrichmentPrograms)
        .where(eq(cruiseEnrichmentPrograms.cruiseId, payload.cruiseId))
      if (payload.programs.length === 0) return []
      const inserted = await tx
        .insert(cruiseEnrichmentPrograms)
        .values(payload.programs.map((p) => ({ ...p, cruiseId: payload.cruiseId })))
        .returning()
      return inserted
    })
  },
}

// ---------- effective itinerary helpers ----------

export type EffectiveItineraryDay = {
  dayNumber: number
  title: string | null
  description: string | null
  portFacilityId: string | null
  arrivalTime: string | null
  departureTime: string | null
  isOvernight: boolean
  isSeaDay: boolean
  isExpeditionLanding: boolean
  isSkipped: boolean
  meals: { breakfast?: boolean; lunch?: boolean; dinner?: boolean }
  hasOverride: boolean
}

function mergeDay(base: CruiseDay, override: CruiseSailingDay | undefined): EffectiveItineraryDay {
  if (!override) {
    return {
      dayNumber: base.dayNumber,
      title: base.title,
      description: base.description,
      portFacilityId: base.portFacilityId,
      arrivalTime: base.arrivalTime,
      departureTime: base.departureTime,
      isOvernight: base.isOvernight,
      isSeaDay: base.isSeaDay,
      isExpeditionLanding: base.isExpeditionLanding,
      isSkipped: false,
      meals: base.meals ?? {},
      hasOverride: false,
    }
  }
  return {
    dayNumber: base.dayNumber,
    title: override.title ?? base.title,
    description: override.description ?? base.description,
    portFacilityId: override.portFacilityId ?? base.portFacilityId,
    arrivalTime: override.arrivalTime ?? base.arrivalTime,
    departureTime: override.departureTime ?? base.departureTime,
    isOvernight: override.isOvernight ?? base.isOvernight,
    isSeaDay: override.isSeaDay ?? base.isSeaDay,
    isExpeditionLanding: override.isExpeditionLanding ?? base.isExpeditionLanding,
    isSkipped: override.isSkipped,
    meals: override.meals ?? base.meals ?? {},
    hasOverride: true,
  }
}

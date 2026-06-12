import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  type CharterProduct,
  type CharterVoyage,
  charterProducts,
  charterVoyages,
  type NewCharterProduct,
  type NewCharterVoyage,
} from "./schema-core.js"
import { type CharterScheduleDay, charterScheduleDays } from "./schema-itinerary.js"
import { type CharterSuite, charterSuites } from "./schema-pricing.js"
import { type CharterYacht, charterYachts } from "./schema-yachts.js"
import type {
  InsertProduct,
  InsertVoyage,
  ProductListQuery,
  UpdateProduct,
  UpdateVoyage,
  VoyageListQuery,
} from "./validation-core.js"
import type { ReplaceVoyageSchedule } from "./validation-itinerary.js"
import type { ReplaceVoyageSuites } from "./validation-pricing.js"
import type { InsertYacht, UpdateYacht, YachtListQuery } from "./validation-yachts.js"

const setUpdated = { updatedAt: new Date() }

function paginate(query: { limit: number; offset: number }) {
  return { limit: query.limit, offset: query.offset }
}

export const chartersService = {
  // ---------- products ----------

  async listProducts(db: PostgresJsDatabase, query: ProductListQuery) {
    const conditions = []
    if (query.status) conditions.push(eq(charterProducts.status, query.status))
    if (query.lineSupplierId)
      conditions.push(eq(charterProducts.lineSupplierId, query.lineSupplierId))
    if (query.region) {
      // agent-quality: raw-sql reviewed -- owner: charters; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      conditions.push(sql`${charterProducts.regions} @> ${JSON.stringify([query.region])}::jsonb`)
    }
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(
        or(ilike(charterProducts.name, term), ilike(charterProducts.description, term)),
      )
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const { limit, offset } = paginate(query)

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(charterProducts)
        .where(where)
        .orderBy(desc(charterProducts.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(charterProducts).where(where),
    ])
    return { data: rows, total: totalRows[0]?.value ?? 0, limit, offset }
  },

  async getProductById(
    db: PostgresJsDatabase,
    id: string,
    options: { withVoyages?: boolean; withYacht?: boolean } = {},
  ): Promise<(CharterProduct & { voyages?: CharterVoyage[]; yacht?: CharterYacht | null }) | null> {
    const [row] = await db.select().from(charterProducts).where(eq(charterProducts.id, id)).limit(1)
    if (!row) return null

    const out: CharterProduct & { voyages?: CharterVoyage[]; yacht?: CharterYacht | null } = {
      ...row,
    }
    if (options.withVoyages) {
      out.voyages = await db
        .select()
        .from(charterVoyages)
        .where(eq(charterVoyages.productId, id))
        .orderBy(asc(charterVoyages.departureDate))
    }
    if (options.withYacht && row.defaultYachtId) {
      const [yacht] = await db
        .select()
        .from(charterYachts)
        .where(eq(charterYachts.id, row.defaultYachtId))
        .limit(1)
      out.yacht = yacht ?? null
    }
    return out
  },

  async createProduct(db: PostgresJsDatabase, data: InsertProduct): Promise<CharterProduct> {
    const [row] = await db
      .insert(charterProducts)
      .values(data as NewCharterProduct)
      .returning()
    if (!row) throw new Error("Failed to create charter product")
    return row
  },

  async updateProduct(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateProduct,
  ): Promise<CharterProduct | null> {
    const [row] = await db
      .update(charterProducts)
      .set({ ...data, ...setUpdated })
      .where(eq(charterProducts.id, id))
      .returning()
    return row ?? null
  },

  async archiveProduct(db: PostgresJsDatabase, id: string): Promise<CharterProduct | null> {
    const [row] = await db
      .update(charterProducts)
      .set({ status: "archived", ...setUpdated })
      .where(eq(charterProducts.id, id))
      .returning()
    return row ?? null
  },

  async recomputeProductAggregates(
    db: PostgresJsDatabase,
    productId: string,
    options: { browseCurrency?: string } = {},
  ): Promise<CharterProduct | null> {
    // Lowest suite price across this product's voyages × suites, in the
    // deployment's chosen browse currency. Defaults to "USD" so existing
    // callers and storefronts that haven't picked a browse currency yet
    // keep their previous behavior; pass `browseCurrency` explicitly to
    // override (e.g. EUR-first European catalog).
    const browseCurrency = options.browseCurrency ?? "USD"
    const [priceAgg] = await db
      .select({
        lowest: sql<
          string | null
        >`MIN(((${charterSuites.pricesByCurrency} ->> ${browseCurrency})::numeric))::text`,
      })
      .from(charterSuites)
      .innerJoin(charterVoyages, eq(charterSuites.voyageId, charterVoyages.id))
      .where(
        and(
          eq(charterVoyages.productId, productId),
          // agent-quality: raw-sql reviewed -- owner: charters; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
          sql`${charterSuites.availability} <> 'sold_out'`,
          // agent-quality: raw-sql reviewed -- owner: charters; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
          sql`(${charterSuites.pricesByCurrency} ? ${browseCurrency})`,
        ),
      )

    const [dateAgg] = await db
      .select({
        earliest: sql<string | null>`MIN(${charterVoyages.departureDate})`,
        latest: sql<string | null>`MAX(${charterVoyages.departureDate})`,
      })
      .from(charterVoyages)
      .where(eq(charterVoyages.productId, productId))

    const [row] = await db
      .update(charterProducts)
      .set({
        lowestPriceCachedAmount: priceAgg?.lowest ?? null,
        lowestPriceCachedCurrency: priceAgg?.lowest ? browseCurrency : null,
        earliestVoyageCached: dateAgg?.earliest ?? null,
        latestVoyageCached: dateAgg?.latest ?? null,
        ...setUpdated,
      })
      .where(eq(charterProducts.id, productId))
      .returning()
    return row ?? null
  },

  // ---------- voyages ----------

  async listVoyages(db: PostgresJsDatabase, query: VoyageListQuery) {
    const conditions = []
    if (query.productId) conditions.push(eq(charterVoyages.productId, query.productId))
    if (query.yachtId) conditions.push(eq(charterVoyages.yachtId, query.yachtId))
    if (query.salesStatus) conditions.push(eq(charterVoyages.salesStatus, query.salesStatus))
    if (query.dateFrom) conditions.push(gte(charterVoyages.departureDate, query.dateFrom))
    if (query.dateTo) conditions.push(lte(charterVoyages.departureDate, query.dateTo))
    if (query.bookingMode) {
      conditions.push(
        // agent-quality: raw-sql reviewed -- owner: charters; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
        sql`${charterVoyages.bookingModes} @> ${JSON.stringify([query.bookingMode])}::jsonb`,
      )
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const { limit, offset } = paginate(query)

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(charterVoyages)
        .where(where)
        .orderBy(asc(charterVoyages.departureDate))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(charterVoyages).where(where),
    ])
    return { data: rows, total: totalRows[0]?.value ?? 0, limit, offset }
  },

  async getVoyageById(
    db: PostgresJsDatabase,
    id: string,
    options: { withSuites?: boolean; withSchedule?: boolean } = {},
  ): Promise<
    | (CharterVoyage & {
        suites?: CharterSuite[]
        schedule?: CharterScheduleDay[]
      })
    | null
  > {
    const [row] = await db.select().from(charterVoyages).where(eq(charterVoyages.id, id)).limit(1)
    if (!row) return null

    const out: CharterVoyage & {
      suites?: CharterSuite[]
      schedule?: CharterScheduleDay[]
    } = { ...row }

    if (options.withSuites) {
      out.suites = await db
        .select()
        .from(charterSuites)
        .where(eq(charterSuites.voyageId, id))
        .orderBy(asc(charterSuites.suiteCode))
    }
    if (options.withSchedule) {
      out.schedule = await db
        .select()
        .from(charterScheduleDays)
        .where(eq(charterScheduleDays.voyageId, id))
        .orderBy(asc(charterScheduleDays.dayNumber))
    }
    return out
  },

  async upsertVoyage(db: PostgresJsDatabase, data: InsertVoyage): Promise<CharterVoyage> {
    const [existing] = await db
      .select()
      .from(charterVoyages)
      .where(
        and(
          eq(charterVoyages.productId, data.productId),
          eq(charterVoyages.departureDate, data.departureDate),
          eq(charterVoyages.yachtId, data.yachtId),
        ),
      )
      .limit(1)

    if (existing) {
      const [row] = await db
        .update(charterVoyages)
        .set({ ...data, ...setUpdated, lastSyncedAt: new Date() } as Partial<NewCharterVoyage>)
        .where(eq(charterVoyages.id, existing.id))
        .returning()
      if (!row) throw new Error("Failed to update voyage")
      return row
    }

    const [row] = await db
      .insert(charterVoyages)
      .values({ ...data, lastSyncedAt: new Date() } as NewCharterVoyage)
      .returning()
    if (!row) throw new Error("Failed to insert voyage")
    return row
  },

  async updateVoyage(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateVoyage,
  ): Promise<CharterVoyage | null> {
    const [row] = await db
      .update(charterVoyages)
      .set({ ...data, ...setUpdated })
      .where(eq(charterVoyages.id, id))
      .returning()
    return row ?? null
  },

  async replaceVoyageSuites(
    db: PostgresJsDatabase,
    payload: ReplaceVoyageSuites,
  ): Promise<CharterSuite[]> {
    return db.transaction(async (tx) => {
      await tx.delete(charterSuites).where(eq(charterSuites.voyageId, payload.voyageId))
      if (payload.suites.length === 0) return []
      const inserted = await tx
        .insert(charterSuites)
        .values(payload.suites.map((s) => ({ ...s, voyageId: payload.voyageId })))
        .returning()
      return inserted
    })
  },

  async replaceVoyageSchedule(
    db: PostgresJsDatabase,
    payload: ReplaceVoyageSchedule,
  ): Promise<CharterScheduleDay[]> {
    return db.transaction(async (tx) => {
      await tx.delete(charterScheduleDays).where(eq(charterScheduleDays.voyageId, payload.voyageId))
      if (payload.days.length === 0) return []
      const inserted = await tx
        .insert(charterScheduleDays)
        .values(payload.days.map((d) => ({ ...d, voyageId: payload.voyageId })))
        .returning()
      return inserted
    })
  },

  // ---------- yachts ----------

  async listYachts(db: PostgresJsDatabase, query: YachtListQuery) {
    const conditions = []
    if (query.lineSupplierId)
      conditions.push(eq(charterYachts.lineSupplierId, query.lineSupplierId))
    if (query.yachtClass) conditions.push(eq(charterYachts.yachtClass, query.yachtClass))
    if (typeof query.isActive === "boolean")
      conditions.push(eq(charterYachts.isActive, query.isActive))
    if (query.search) conditions.push(ilike(charterYachts.name, `%${query.search}%`))
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const { limit, offset } = paginate(query)

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(charterYachts)
        .where(where)
        .orderBy(asc(charterYachts.name))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(charterYachts).where(where),
    ])
    return { data: rows, total: totalRows[0]?.value ?? 0, limit, offset }
  },

  async getYachtById(db: PostgresJsDatabase, id: string): Promise<CharterYacht | null> {
    const [row] = await db.select().from(charterYachts).where(eq(charterYachts.id, id)).limit(1)
    return row ?? null
  },

  async createYacht(db: PostgresJsDatabase, data: InsertYacht): Promise<CharterYacht> {
    const [row] = await db.insert(charterYachts).values(data).returning()
    if (!row) throw new Error("Failed to create yacht")
    return row
  },

  async updateYacht(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateYacht,
  ): Promise<CharterYacht | null> {
    const [row] = await db
      .update(charterYachts)
      .set({ ...data, ...setUpdated })
      .where(eq(charterYachts.id, id))
      .returning()
    return row ?? null
  },
}

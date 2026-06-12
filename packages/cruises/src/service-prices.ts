import { and, asc, count, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { cruiseSailings } from "./schema-core.js"
import type { CruisePrice, NewCruisePrice, NewCruisePriceComponent } from "./schema-pricing.js"
import { cruisePriceComponents, cruisePrices } from "./schema-pricing.js"
import { paginate, reprojectIfPossible, setUpdated } from "./service-shared.js"
import type {
  InsertPrice,
  InsertPriceComponent,
  PriceListQuery,
  UpdatePrice,
} from "./validation-pricing.js"

export const cruisePriceRowsService = {
  async listPrices(db: PostgresJsDatabase, query: PriceListQuery) {
    const conditions = []
    if (query.sailingId) conditions.push(eq(cruisePrices.sailingId, query.sailingId))
    if (query.cabinCategoryId)
      conditions.push(eq(cruisePrices.cabinCategoryId, query.cabinCategoryId))
    if (query.occupancy) conditions.push(eq(cruisePrices.occupancy, query.occupancy))
    if (query.fareCode) conditions.push(eq(cruisePrices.fareCode, query.fareCode))
    if (query.fareVariant) conditions.push(eq(cruisePrices.fareVariant, query.fareVariant))
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
}

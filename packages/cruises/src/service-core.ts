import { listResponse } from "@voyant-travel/types"
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  CRUISE_CREATED_EVENT,
  CRUISE_DELETED_EVENT,
  CRUISE_UPDATED_EVENT,
  emitCruiseLifecycleEvent,
} from "./events.js"
import type {
  Cruise,
  CruiseSailing,
  CruiseVoyageGroup,
  CruiseVoyageGroupSegment,
  NewCruise,
  NewCruiseVoyageGroup,
  NewCruiseVoyageGroupSegment,
} from "./schema-core.js"
import {
  cruiseSailings,
  cruises,
  cruiseVoyageGroupSegments,
  cruiseVoyageGroups,
} from "./schema-core.js"
import type { CruiseDay } from "./schema-itinerary.js"
import { cruiseDays } from "./schema-itinerary.js"
import { cruisePrices } from "./schema-pricing.js"
import {
  type CruiseMutationRuntime,
  paginate,
  reprojectCruise,
  reprojectIfPossible,
  setUpdated,
} from "./service-shared.js"
import type {
  CruiseListQuery,
  InsertCruise,
  InsertVoyageGroup,
  InsertVoyageGroupSegment,
  UpdateCruise,
  UpdateVoyageGroup,
  UpdateVoyageGroupSegment,
  VoyageGroupListQuery,
  VoyageGroupSegmentListQuery,
} from "./validation-core.js"

export const cruiseCoreService = {
  async listVoyageGroups(db: PostgresJsDatabase, query: VoyageGroupListQuery) {
    const conditions = []
    if (query.groupKind) conditions.push(eq(cruiseVoyageGroups.groupKind, query.groupKind))
    if (query.status) conditions.push(eq(cruiseVoyageGroups.status, query.status))
    if (query.lineSupplierId) {
      conditions.push(eq(cruiseVoyageGroups.lineSupplierId, query.lineSupplierId))
    }
    if (query.region) {
      conditions.push(
        // agent-quality: raw-sql reviewed -- owner: cruises; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
        sql`${cruiseVoyageGroups.regions} @> ${JSON.stringify([query.region])}::jsonb`,
      )
    }
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(
        or(ilike(cruiseVoyageGroups.name, term), ilike(cruiseVoyageGroups.description, term)),
      )
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const { limit, offset } = paginate(query)

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(cruiseVoyageGroups)
        .where(where)
        .orderBy(desc(cruiseVoyageGroups.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(cruiseVoyageGroups).where(where),
    ])
    return listResponse(rows, { total: totalRows[0]?.value ?? 0, limit, offset })
  },

  async getVoyageGroupById(
    db: PostgresJsDatabase,
    id: string,
    options: { withSegments?: boolean } = {},
  ): Promise<
    | (CruiseVoyageGroup & {
        segments?: CruiseVoyageGroupSegment[]
      })
    | null
  > {
    const [row] = await db
      .select()
      .from(cruiseVoyageGroups)
      .where(eq(cruiseVoyageGroups.id, id))
      .limit(1)
    if (!row) return null

    const out: CruiseVoyageGroup & { segments?: CruiseVoyageGroupSegment[] } = { ...row }
    if (options.withSegments) {
      out.segments = await db
        .select()
        .from(cruiseVoyageGroupSegments)
        .where(eq(cruiseVoyageGroupSegments.voyageGroupId, id))
        .orderBy(asc(cruiseVoyageGroupSegments.sortOrder))
    }
    return out
  },

  async createVoyageGroup(
    db: PostgresJsDatabase,
    data: InsertVoyageGroup,
  ): Promise<CruiseVoyageGroup> {
    const [row] = await db
      .insert(cruiseVoyageGroups)
      .values(data as NewCruiseVoyageGroup)
      .returning()
    if (!row) throw new Error("Failed to create voyage group")
    return row
  },

  async updateVoyageGroup(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateVoyageGroup,
  ): Promise<CruiseVoyageGroup | null> {
    const [row] = await db
      .update(cruiseVoyageGroups)
      .set({ ...data, ...setUpdated })
      .where(eq(cruiseVoyageGroups.id, id))
      .returning()
    return row ?? null
  },

  async archiveVoyageGroup(db: PostgresJsDatabase, id: string): Promise<CruiseVoyageGroup | null> {
    const [row] = await db
      .update(cruiseVoyageGroups)
      .set({ status: "archived", ...setUpdated })
      .where(eq(cruiseVoyageGroups.id, id))
      .returning()
    return row ?? null
  },

  async listVoyageGroupSegments(db: PostgresJsDatabase, query: VoyageGroupSegmentListQuery) {
    const conditions = []
    if (query.voyageGroupId) {
      conditions.push(eq(cruiseVoyageGroupSegments.voyageGroupId, query.voyageGroupId))
    }
    if (query.cruiseId) conditions.push(eq(cruiseVoyageGroupSegments.cruiseId, query.cruiseId))
    if (query.sailingId) conditions.push(eq(cruiseVoyageGroupSegments.sailingId, query.sailingId))
    if (query.segmentKind) {
      conditions.push(eq(cruiseVoyageGroupSegments.segmentKind, query.segmentKind))
    }
    if (query.segmentRole) {
      conditions.push(eq(cruiseVoyageGroupSegments.segmentRole, query.segmentRole))
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const { limit, offset } = paginate(query)

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(cruiseVoyageGroupSegments)
        .where(where)
        .orderBy(
          asc(cruiseVoyageGroupSegments.voyageGroupId),
          asc(cruiseVoyageGroupSegments.sortOrder),
        )
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(cruiseVoyageGroupSegments).where(where),
    ])
    return listResponse(rows, { total: totalRows[0]?.value ?? 0, limit, offset })
  },

  async createVoyageGroupSegment(
    db: PostgresJsDatabase,
    data: InsertVoyageGroupSegment,
  ): Promise<CruiseVoyageGroupSegment> {
    const [row] = await db
      .insert(cruiseVoyageGroupSegments)
      .values(data as NewCruiseVoyageGroupSegment)
      .returning()
    if (!row) throw new Error("Failed to create voyage group segment")
    return row
  },

  async updateVoyageGroupSegment(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateVoyageGroupSegment,
  ): Promise<CruiseVoyageGroupSegment | null> {
    const [row] = await db
      .update(cruiseVoyageGroupSegments)
      .set({ ...data, ...setUpdated })
      .where(eq(cruiseVoyageGroupSegments.id, id))
      .returning()
    return row ?? null
  },

  async deleteVoyageGroupSegment(db: PostgresJsDatabase, id: string): Promise<boolean> {
    const rows = await db
      .delete(cruiseVoyageGroupSegments)
      .where(eq(cruiseVoyageGroupSegments.id, id))
      .returning({ id: cruiseVoyageGroupSegments.id })
    return rows.length > 0
  },

  async listCruises(db: PostgresJsDatabase, query: CruiseListQuery) {
    const conditions = []
    if (query.cruiseType) conditions.push(eq(cruises.cruiseType, query.cruiseType))
    if (query.status) conditions.push(eq(cruises.status, query.status))
    if (query.lineSupplierId) conditions.push(eq(cruises.lineSupplierId, query.lineSupplierId))
    if (query.region) {
      // agent-quality: raw-sql reviewed -- owner: cruises; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
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
    return listResponse(rows, { total: totalRows[0]?.value ?? 0, limit, offset })
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
    if (runtime.projection === "required") {
      await reprojectCruise(db, row.id)
    } else {
      await reprojectIfPossible(db, row.id)
    }
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
        // agent-quality: raw-sql reviewed -- owner: cruises; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
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
}

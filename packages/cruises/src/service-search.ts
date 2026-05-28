/**
 * Search-index service. Powers the storefront's catalog browse + filter and
 * the admin "list everything" view when both local and external entries are
 * mixed together.
 *
 * The `cruise_search_index` table is intentionally optional — operators
 * running back-office only never populate it. Storefront-enabled deployments
 * either:
 *   - Let the local-projection trigger keep self-managed entries fresh
 *     (already wired into cruisesService mutations), and
 *   - Have each registered adapter call `bulkUpsert` (or feed
 *     `searchProjection()` deltas) to keep external entries fresh.
 */

import { and, asc, eq, gte, ilike, lte, or, type SQL, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { CruiseAdapter, SourceRef } from "./adapters/index.js"
import { listCruiseAdapters } from "./adapters/registry.js"
import { cruiseShips } from "./schema-cabins.js"
import { type Cruise, cruiseSailings, cruises } from "./schema-core.js"
import { cruisePrices } from "./schema-pricing.js"
import {
  type CruiseSearchIndexRow,
  cruiseSearchIndex,
  type NewCruiseSearchIndexRow,
} from "./schema-search.js"
import type { SearchIndexQuery } from "./validation-search.js"

// ---------- query payload ----------

export type SearchIndexQueryResult = {
  data: CruiseSearchIndexRow[]
  total: number
  limit: number
  offset: number
}

// ---------- bulk upsert payload (adapters call this) ----------

export type BulkSearchIndexEntry = {
  source: "local" | "external"
  sourceProvider?: string | null
  sourceRef?: SourceRef | null
  localCruiseId?: string | null
  slug: string
  name: string
  cruiseType: "ocean" | "river" | "expedition" | "coastal"
  lineName: string
  shipName: string
  nights: number
  embarkPortName?: string | null
  disembarkPortName?: string | null
  regions?: string[]
  themes?: string[]
  earliestDeparture?: string | null
  latestDeparture?: string | null
  lowestPrice?: string | null
  lowestPriceCurrency?: string | null
  salesStatus?: string | null
  heroImageUrl?: string | null
}

export type RebuildResult = {
  localUpserted: number
  externalUpserted: number
  externalErrors: Array<{ adapter: string; error: string }>
}

export const cruisesSearchService = {
  // ---------- queries ----------

  async query(db: PostgresJsDatabase, query: SearchIndexQuery): Promise<SearchIndexQueryResult> {
    const conditions: SQL[] = []
    if (query.cruiseType) conditions.push(eq(cruiseSearchIndex.cruiseType, query.cruiseType))
    if (query.source) conditions.push(eq(cruiseSearchIndex.source, query.source))
    if (query.region) {
      conditions.push(sql`${cruiseSearchIndex.regions} @> ${JSON.stringify([query.region])}::jsonb`)
    }
    if (query.theme) {
      conditions.push(sql`${cruiseSearchIndex.themes} @> ${JSON.stringify([query.theme])}::jsonb`)
    }
    if (query.dateFrom) conditions.push(gte(cruiseSearchIndex.earliestDeparture, query.dateFrom))
    if (query.dateTo) conditions.push(lte(cruiseSearchIndex.latestDeparture, query.dateTo))
    if (query.priceMax !== undefined) {
      conditions.push(sql`${cruiseSearchIndex.lowestPrice}::numeric <= ${query.priceMax}`)
    }
    if (query.search) {
      const term = `%${query.search}%`
      const searchClause = or(
        ilike(cruiseSearchIndex.name, term),
        ilike(cruiseSearchIndex.lineName, term),
        ilike(cruiseSearchIndex.shipName, term),
      )
      if (searchClause) conditions.push(searchClause)
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(cruiseSearchIndex)
        .where(where)
        .orderBy(
          asc(cruiseSearchIndex.earliestDeparture),
          asc(sql`${cruiseSearchIndex.lowestPrice}::numeric NULLS LAST`),
          asc(cruiseSearchIndex.name),
        )
        .limit(query.limit)
        .offset(query.offset),
      db.select({ value: sql<number>`count(*)::int` }).from(cruiseSearchIndex).where(where),
    ])
    return {
      data: rows,
      total: totalRows[0]?.value ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getBySlug(db: PostgresJsDatabase, slug: string): Promise<CruiseSearchIndexRow | null> {
    const [row] = await db
      .select()
      .from(cruiseSearchIndex)
      .where(eq(cruiseSearchIndex.slug, slug))
      .limit(1)
    return row ?? null
  },

  // ---------- writes ----------

  async upsertEntry(
    db: PostgresJsDatabase,
    entry: BulkSearchIndexEntry,
  ): Promise<CruiseSearchIndexRow> {
    const payload: NewCruiseSearchIndexRow = {
      source: entry.source,
      sourceProvider: entry.sourceProvider ?? null,
      sourceRef: entry.sourceRef ?? null,
      localCruiseId: entry.localCruiseId ?? null,
      slug: entry.slug,
      name: entry.name,
      cruiseType: entry.cruiseType,
      lineName: entry.lineName,
      shipName: entry.shipName,
      nights: entry.nights,
      embarkPortName: entry.embarkPortName ?? null,
      disembarkPortName: entry.disembarkPortName ?? null,
      regions: entry.regions ?? [],
      themes: entry.themes ?? [],
      earliestDeparture: entry.earliestDeparture ?? null,
      latestDeparture: entry.latestDeparture ?? null,
      lowestPrice: entry.lowestPrice ?? null,
      lowestPriceCurrency: entry.lowestPriceCurrency ?? null,
      salesStatus: entry.salesStatus ?? null,
      heroImageUrl: entry.heroImageUrl ?? null,
      refreshedAt: new Date(),
    }

    const existing = await findExisting(db, entry)
    if (existing) {
      const [row] = await db
        .update(cruiseSearchIndex)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(cruiseSearchIndex.id, existing.id))
        .returning()
      if (!row) throw new Error("Failed to update search index entry")
      return row
    }

    const [row] = await db.insert(cruiseSearchIndex).values(payload).returning()
    if (!row) throw new Error("Failed to insert search index entry")
    return row
  },

  async bulkUpsert(
    db: PostgresJsDatabase,
    entries: BulkSearchIndexEntry[],
  ): Promise<{ upserted: number }> {
    let upserted = 0
    // Run in a transaction so a partial run can roll back. Adapters typically
    // call this in chunks; the chunk size is the adapter's choice.
    await db.transaction(async (tx) => {
      for (const entry of entries) {
        await this.upsertEntry(tx, entry)
        upserted++
      }
    })
    return { upserted }
  },

  async removeEntry(db: PostgresJsDatabase, id: string): Promise<boolean> {
    const result = await db
      .delete(cruiseSearchIndex)
      .where(eq(cruiseSearchIndex.id, id))
      .returning({ id: cruiseSearchIndex.id })
    return result.length > 0
  },

  async removeBySource(
    db: PostgresJsDatabase,
    sourceProvider: string,
  ): Promise<{ removed: number }> {
    const result = await db
      .delete(cruiseSearchIndex)
      .where(
        and(
          eq(cruiseSearchIndex.source, "external"),
          eq(cruiseSearchIndex.sourceProvider, sourceProvider),
        ),
      )
      .returning({ id: cruiseSearchIndex.id })
    return { removed: result.length }
  },

  // ---------- projection from local cruises ----------

  /**
   * Re-project a single local cruise into the search index. Called from the
   * cruisesService mutation hooks so the index stays fresh without a separate
   * scheduled job. Computes the lowest available price across the cruise's
   * sailings and the earliest/latest departure dates.
   *
   * If the cruise's status is 'archived' the entry is removed instead — archived
   * cruises shouldn't appear on the storefront.
   */
  async projectLocalCruise(
    db: PostgresJsDatabase,
    cruiseId: string,
  ): Promise<CruiseSearchIndexRow | null> {
    const [cruise] = await db.select().from(cruises).where(eq(cruises.id, cruiseId)).limit(1)
    if (!cruise) {
      // Cruise was deleted — drop any matching index row.
      await db.delete(cruiseSearchIndex).where(eq(cruiseSearchIndex.localCruiseId, cruiseId))
      return null
    }
    if (cruise.status === "archived") {
      await db.delete(cruiseSearchIndex).where(eq(cruiseSearchIndex.localCruiseId, cruiseId))
      return null
    }

    const entry = await buildLocalEntry(db, cruise)
    if (!entry) return null
    return this.upsertEntry(db, entry)
  },

  /**
   * Drop and rebuild every local cruise entry. Useful after schema changes
   * or operator-triggered "rebuild storefront index" actions.
   */
  async rebuildLocal(db: PostgresJsDatabase): Promise<{ upserted: number }> {
    // Remove all local entries first so deleted cruises don't linger.
    await db.delete(cruiseSearchIndex).where(eq(cruiseSearchIndex.source, "local"))
    const allCruises = await db.select().from(cruises).where(sql`${cruises.status} <> 'archived'`)
    let upserted = 0
    for (const cruise of allCruises) {
      const entry = await buildLocalEntry(db, cruise)
      if (!entry) continue
      await this.upsertEntry(db, entry)
      upserted++
    }
    return { upserted }
  },

  /**
   * Drain `searchProjection()` from a single adapter and bulk-upsert. Useful
   * for ad-hoc "refresh from upstream" actions; production deployments
   * typically have the adapter push deltas continuously instead.
   */
  async rebuildExternalForAdapter(
    db: PostgresJsDatabase,
    adapter: CruiseAdapter,
  ): Promise<{ upserted: number }> {
    let upserted = 0
    for await (const entry of adapter.searchProjection()) {
      await this.upsertEntry(db, {
        source: "external",
        sourceProvider: adapter.name,
        sourceRef: entry.sourceRef,
        slug: entry.slug,
        name: entry.name,
        cruiseType: entry.cruiseType,
        lineName: entry.lineName,
        shipName: entry.shipName,
        nights: entry.nights,
        embarkPortName: entry.embarkPortName ?? null,
        disembarkPortName: entry.disembarkPortName ?? null,
        regions: entry.regions ?? [],
        themes: entry.themes ?? [],
        earliestDeparture: entry.earliestDeparture ?? null,
        latestDeparture: entry.latestDeparture ?? null,
        lowestPrice: entry.lowestPrice ?? null,
        lowestPriceCurrency: entry.lowestPriceCurrency ?? null,
        salesStatus: entry.salesStatus ?? null,
        heroImageUrl: entry.heroImageUrl ?? null,
      })
      upserted++
    }
    return { upserted }
  },

  /**
   * Full rebuild — local cruises + every registered adapter.
   * Per-adapter errors are collected so one bad adapter doesn't block the rest.
   */
  async rebuildAll(db: PostgresJsDatabase): Promise<RebuildResult> {
    const localResult = await this.rebuildLocal(db)
    const externalErrors: RebuildResult["externalErrors"] = []
    let externalUpserted = 0
    for (const adapter of listCruiseAdapters()) {
      try {
        await db
          .delete(cruiseSearchIndex)
          .where(
            and(
              eq(cruiseSearchIndex.source, "external"),
              eq(cruiseSearchIndex.sourceProvider, adapter.name),
            ),
          )
        const result = await this.rebuildExternalForAdapter(db, adapter)
        externalUpserted += result.upserted
      } catch (err) {
        externalErrors.push({ adapter: adapter.name, error: (err as Error).message })
      }
    }
    return {
      localUpserted: localResult.upserted,
      externalUpserted,
      externalErrors,
    }
  },
}

// ---------- helpers ----------

async function findExisting(
  db: PostgresJsDatabase,
  entry: BulkSearchIndexEntry,
): Promise<CruiseSearchIndexRow | null> {
  if (entry.source === "local" && entry.localCruiseId) {
    const [row] = await db
      .select()
      .from(cruiseSearchIndex)
      .where(eq(cruiseSearchIndex.localCruiseId, entry.localCruiseId))
      .limit(1)
    if (row) return row
  }
  if (entry.source === "external" && entry.sourceProvider && entry.sourceRef) {
    const [row] = await db
      .select()
      .from(cruiseSearchIndex)
      .where(
        and(
          eq(cruiseSearchIndex.source, "external"),
          eq(cruiseSearchIndex.sourceProvider, entry.sourceProvider),
          sql`${cruiseSearchIndex.sourceRef} = ${sourceRefIdentityJson(entry.sourceRef)}::jsonb`,
        ),
      )
      .limit(1)
    if (row) return row
  }
  // Fallback: match by slug (slug is unique across the index).
  const [bySlug] = await db
    .select()
    .from(cruiseSearchIndex)
    .where(eq(cruiseSearchIndex.slug, entry.slug))
    .limit(1)
  return bySlug ?? null
}

export function sourceRefIdentityJson(sourceRef: SourceRef): string {
  return JSON.stringify(sortValue(sourceRef))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== "object") return value
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) {
    out[key] = sortValue((value as Record<string, unknown>)[key])
  }
  return out
}

async function buildLocalEntry(
  db: PostgresJsDatabase,
  cruise: Cruise,
): Promise<BulkSearchIndexEntry | null> {
  // Resolve ship name. Falls back to "—" when no default ship is set; storefront
  // can hide rows without a ship if it cares, but most local cruises have one.
  let shipName = "—"
  if (cruise.defaultShipId) {
    const [ship] = await db
      .select({ name: cruiseShips.name })
      .from(cruiseShips)
      .where(eq(cruiseShips.id, cruise.defaultShipId))
      .limit(1)
    if (ship) shipName = ship.name
  }

  // Aggregate over sailings + prices in two parallel queries.
  const [dateAgg] = await db
    .select({
      earliest: sql<string | null>`MIN(${cruiseSailings.departureDate})`,
      latest: sql<string | null>`MAX(${cruiseSailings.departureDate})`,
    })
    .from(cruiseSailings)
    .where(eq(cruiseSailings.cruiseId, cruise.id))

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
      and(eq(cruiseSailings.cruiseId, cruise.id), sql`${cruisePrices.availability} <> 'sold_out'`),
    )

  // Sales status is a coarse roll-up: if any sailing is open, the cruise is open.
  const [salesAgg] = await db
    .select({
      hasOpen: sql<boolean>`bool_or(${cruiseSailings.salesStatus} = 'open')`,
    })
    .from(cruiseSailings)
    .where(eq(cruiseSailings.cruiseId, cruise.id))

  const salesStatus = salesAgg?.hasOpen ? "open" : "closed"

  return {
    source: "local",
    sourceProvider: null,
    sourceRef: null,
    localCruiseId: cruise.id,
    slug: cruise.slug,
    name: cruise.name,
    cruiseType: cruise.cruiseType,
    lineName: cruise.lineSupplierId ?? "—",
    shipName,
    nights: cruise.nights,
    regions: cruise.regions ?? [],
    themes: cruise.themes ?? [],
    earliestDeparture: dateAgg?.earliest ?? null,
    latestDeparture: dateAgg?.latest ?? null,
    lowestPrice: priceAgg?.lowest ?? cruise.lowestPriceCached ?? null,
    lowestPriceCurrency: priceAgg?.currency ?? cruise.lowestPriceCurrencyCached ?? null,
    salesStatus,
    heroImageUrl: cruise.heroImageUrl ?? null,
  }
}

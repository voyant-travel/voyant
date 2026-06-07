import { asc, eq, isNull, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { costCategories } from "./schema.js"

/**
 * Operator-configurable cost categories. Used to classify supplier-invoice
 * lines and drive the per-category cost breakdown. Seeded lazily with sensible
 * defaults the first time the list is read, so a fresh operator already has
 * transportation / accommodation / guides / other to pick from.
 */

const DEFAULT_CATEGORIES = [
  "Transportation",
  "Accommodation",
  "Guides / touristic services",
  "Other",
]

export interface CostCategoryRecord {
  id: string
  name: string
  sortOrder: number
  archived: boolean
  createdAt: string
  updatedAt: string
}

function toRecord(row: typeof costCategories.$inferSelect): CostCategoryRecord {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    archived: row.archivedAt != null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const costCategoriesService = {
  async list(
    db: PostgresJsDatabase,
    options: { includeArchived?: boolean } = {},
  ): Promise<CostCategoryRecord[]> {
    const existing = await db.select().from(costCategories)
    if (existing.length === 0) {
      await db
        .insert(costCategories)
        .values(DEFAULT_CATEGORIES.map((name, index) => ({ name, sortOrder: index })))
        .onConflictDoNothing()
    }
    const rows = await db
      .select()
      .from(costCategories)
      .where(options.includeArchived ? undefined : isNull(costCategories.archivedAt))
      .orderBy(asc(costCategories.sortOrder), asc(costCategories.name))
    return rows.map(toRecord)
  },

  async create(
    db: PostgresJsDatabase,
    input: { name: string; sortOrder?: number },
  ): Promise<CostCategoryRecord> {
    const [row] = await db
      .insert(costCategories)
      .values({ name: input.name.trim(), sortOrder: input.sortOrder ?? 0 })
      .returning()
    if (!row) throw new Error("Failed to create cost category")
    return toRecord(row)
  },

  async update(
    db: PostgresJsDatabase,
    id: string,
    input: { name?: string; sortOrder?: number; archived?: boolean },
  ): Promise<CostCategoryRecord | null> {
    const patch: Partial<typeof costCategories.$inferInsert> = { updatedAt: new Date() }
    if (input.name !== undefined) patch.name = input.name.trim()
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
    if (input.archived !== undefined) patch.archivedAt = input.archived ? new Date() : null
    const [row] = await db
      .update(costCategories)
      .set(patch)
      .where(eq(costCategories.id, id))
      .returning()
    return row ? toRecord(row) : null
  },

  /** Resolve id → name for a set of category ids (for breakdown labelling). */
  async nameMap(db: PostgresJsDatabase, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map()
    const rows = await db
      .select({ id: costCategories.id, name: costCategories.name })
      .from(costCategories)
      .where(sql`${costCategories.id} = any(${ids})`)
    return new Map(rows.map((r) => [r.id, r.name]))
  },
}

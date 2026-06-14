import { and, asc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import {
  productActivationSettings,
  productCapabilities,
  products,
  productTicketSettings,
  productVisibilitySettings,
} from "./schema.js"
import type {
  insertProductActivationSettingSchema,
  insertProductCapabilitySchema,
  insertProductTicketSettingSchema,
  insertProductVisibilitySettingSchema,
  productActivationSettingListQuerySchema,
  productCapabilityListQuerySchema,
  productTicketSettingListQuerySchema,
  productVisibilitySettingListQuerySchema,
  updateProductActivationSettingSchema,
  updateProductCapabilitySchema,
  updateProductTicketSettingSchema,
  updateProductVisibilitySettingSchema,
} from "./validation.js"

type ProductActivationSettingListQuery = z.infer<typeof productActivationSettingListQuerySchema>
type CreateProductActivationSettingInput = z.infer<typeof insertProductActivationSettingSchema>
type UpdateProductActivationSettingInput = z.infer<typeof updateProductActivationSettingSchema>
type ProductTicketSettingListQuery = z.infer<typeof productTicketSettingListQuerySchema>
type CreateProductTicketSettingInput = z.infer<typeof insertProductTicketSettingSchema>
type UpdateProductTicketSettingInput = z.infer<typeof updateProductTicketSettingSchema>
type ProductVisibilitySettingListQuery = z.infer<typeof productVisibilitySettingListQuerySchema>
type CreateProductVisibilitySettingInput = z.infer<typeof insertProductVisibilitySettingSchema>
type UpdateProductVisibilitySettingInput = z.infer<typeof updateProductVisibilitySettingSchema>
type ProductCapabilityListQuery = z.infer<typeof productCapabilityListQuerySchema>
type CreateProductCapabilityInput = z.infer<typeof insertProductCapabilitySchema>
type UpdateProductCapabilityInput = z.infer<typeof updateProductCapabilitySchema>

async function ensureProductExists(db: PostgresJsDatabase, productId: string) {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  return product ?? null
}

export const configurationProductsService = {
  async listActivationSettings(db: PostgresJsDatabase, query: ProductActivationSettingListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productActivationSettings.productId, query.productId))
    }

    if (query.activationMode) {
      conditions.push(eq(productActivationSettings.activationMode, query.activationMode))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productActivationSettings)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productActivationSettings.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productActivationSettings).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getActivationSettingById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productActivationSettings)
      .where(eq(productActivationSettings.id, id))
      .limit(1)

    return row ?? null
  },

  async getActivationSettingByProductId(db: PostgresJsDatabase, productId: string) {
    const [row] = await db
      .select()
      .from(productActivationSettings)
      .where(eq(productActivationSettings.productId, productId))
      .limit(1)

    return row ?? null
  },

  async upsertActivationSetting(
    db: PostgresJsDatabase,
    productId: string,
    data: CreateProductActivationSettingInput,
  ) {
    const product = await ensureProductExists(db, productId)
    if (!product) {
      return null
    }

    const [row] = await db
      .insert(productActivationSettings)
      .values({
        productId,
        ...data,
        activateAt: data.activateAt ? new Date(data.activateAt) : null,
        deactivateAt: data.deactivateAt ? new Date(data.deactivateAt) : null,
        sellAt: data.sellAt ? new Date(data.sellAt) : null,
        stopSellAt: data.stopSellAt ? new Date(data.stopSellAt) : null,
      })
      .onConflictDoUpdate({
        target: productActivationSettings.productId,
        set: {
          ...data,
          activateAt: data.activateAt ? new Date(data.activateAt) : null,
          deactivateAt: data.deactivateAt ? new Date(data.deactivateAt) : null,
          sellAt: data.sellAt ? new Date(data.sellAt) : null,
          stopSellAt: data.stopSellAt ? new Date(data.stopSellAt) : null,
          updatedAt: new Date(),
        },
      })
      .returning()

    return row ?? null
  },

  async updateActivationSetting(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateProductActivationSettingInput,
  ) {
    const [row] = await db
      .update(productActivationSettings)
      .set({
        ...data,
        activateAt:
          data.activateAt === undefined
            ? undefined
            : data.activateAt
              ? new Date(data.activateAt)
              : null,
        deactivateAt:
          data.deactivateAt === undefined
            ? undefined
            : data.deactivateAt
              ? new Date(data.deactivateAt)
              : null,
        sellAt: data.sellAt === undefined ? undefined : data.sellAt ? new Date(data.sellAt) : null,
        stopSellAt:
          data.stopSellAt === undefined
            ? undefined
            : data.stopSellAt
              ? new Date(data.stopSellAt)
              : null,
        updatedAt: new Date(),
      })
      .where(eq(productActivationSettings.id, id))
      .returning()

    return row ?? null
  },

  async deleteActivationSetting(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productActivationSettings)
      .where(eq(productActivationSettings.id, id))
      .returning({ id: productActivationSettings.id })

    return row ?? null
  },

  async listTicketSettings(db: PostgresJsDatabase, query: ProductTicketSettingListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productTicketSettings.productId, query.productId))
    }

    if (query.fulfillmentMode) {
      conditions.push(eq(productTicketSettings.fulfillmentMode, query.fulfillmentMode))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productTicketSettings)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productTicketSettings.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productTicketSettings).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getTicketSettingById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productTicketSettings)
      .where(eq(productTicketSettings.id, id))
      .limit(1)

    return row ?? null
  },

  async getTicketSettingByProductId(db: PostgresJsDatabase, productId: string) {
    const [row] = await db
      .select()
      .from(productTicketSettings)
      .where(eq(productTicketSettings.productId, productId))
      .limit(1)

    return row ?? null
  },

  async upsertTicketSetting(
    db: PostgresJsDatabase,
    productId: string,
    data: CreateProductTicketSettingInput,
  ) {
    const product = await ensureProductExists(db, productId)
    if (!product) {
      return null
    }

    const [row] = await db
      .insert(productTicketSettings)
      .values({ productId, ...data })
      .onConflictDoUpdate({
        target: productTicketSettings.productId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning()

    return row ?? null
  },

  async updateTicketSetting(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateProductTicketSettingInput,
  ) {
    const [row] = await db
      .update(productTicketSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productTicketSettings.id, id))
      .returning()

    return row ?? null
  },

  async deleteTicketSetting(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productTicketSettings)
      .where(eq(productTicketSettings.id, id))
      .returning({ id: productTicketSettings.id })

    return row ?? null
  },

  async listVisibilitySettings(db: PostgresJsDatabase, query: ProductVisibilitySettingListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productVisibilitySettings.productId, query.productId))
    }

    if (query.isSearchable !== undefined) {
      conditions.push(eq(productVisibilitySettings.isSearchable, query.isSearchable))
    }

    if (query.isBookable !== undefined) {
      conditions.push(eq(productVisibilitySettings.isBookable, query.isBookable))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productVisibilitySettings)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productVisibilitySettings.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productVisibilitySettings).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getVisibilitySettingById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productVisibilitySettings)
      .where(eq(productVisibilitySettings.id, id))
      .limit(1)

    return row ?? null
  },

  async getVisibilitySettingByProductId(db: PostgresJsDatabase, productId: string) {
    const [row] = await db
      .select()
      .from(productVisibilitySettings)
      .where(eq(productVisibilitySettings.productId, productId))
      .limit(1)

    return row ?? null
  },

  async upsertVisibilitySetting(
    db: PostgresJsDatabase,
    productId: string,
    data: CreateProductVisibilitySettingInput,
  ) {
    const product = await ensureProductExists(db, productId)
    if (!product) {
      return null
    }

    const [row] = await db
      .insert(productVisibilitySettings)
      .values({ productId, ...data })
      .onConflictDoUpdate({
        target: productVisibilitySettings.productId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning()

    return row ?? null
  },

  async updateVisibilitySetting(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateProductVisibilitySettingInput,
  ) {
    const [row] = await db
      .update(productVisibilitySettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productVisibilitySettings.id, id))
      .returning()

    return row ?? null
  },

  async deleteVisibilitySetting(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productVisibilitySettings)
      .where(eq(productVisibilitySettings.id, id))
      .returning({ id: productVisibilitySettings.id })

    return row ?? null
  },

  async listCapabilities(db: PostgresJsDatabase, query: ProductCapabilityListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productCapabilities.productId, query.productId))
    }

    if (query.capability) {
      conditions.push(eq(productCapabilities.capability, query.capability))
    }

    if (query.enabled !== undefined) {
      conditions.push(eq(productCapabilities.enabled, query.enabled))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productCapabilities)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productCapabilities.capability), asc(productCapabilities.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productCapabilities).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getCapabilityById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productCapabilities)
      .where(eq(productCapabilities.id, id))
      .limit(1)

    return row ?? null
  },

  async getCapabilityByProductAndName(
    db: PostgresJsDatabase,
    productId: string,
    capability: CreateProductCapabilityInput["capability"],
  ) {
    const [row] = await db
      .select()
      .from(productCapabilities)
      .where(
        and(
          eq(productCapabilities.productId, productId),
          eq(productCapabilities.capability, capability),
        ),
      )
      .limit(1)

    return row ?? null
  },

  async createCapability(
    db: PostgresJsDatabase,
    productId: string,
    data: CreateProductCapabilityInput,
  ) {
    const product = await ensureProductExists(db, productId)
    if (!product) {
      return null
    }

    const [row] = await db
      .insert(productCapabilities)
      .values({ productId, ...data })
      .onConflictDoUpdate({
        target: [productCapabilities.productId, productCapabilities.capability],
        set: {
          enabled: data.enabled,
          notes: data.notes ?? null,
          updatedAt: new Date(),
        },
      })
      .returning()

    return row ?? null
  },

  async updateCapability(db: PostgresJsDatabase, id: string, data: UpdateProductCapabilityInput) {
    const [row] = await db
      .update(productCapabilities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productCapabilities.id, id))
      .returning()

    return row ?? null
  },

  async deleteCapability(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productCapabilities)
      .where(eq(productCapabilities.id, id))
      .returning({ id: productCapabilities.id })

    return row ?? null
  },
}

import { and, asc, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import { productDays, productItineraries, productMedia, products } from "./schema.js"
import type {
  insertProductMediaSchema,
  productMediaListQuerySchema,
  reorderProductMediaSchema,
  updateProductMediaSchema,
  upsertProductBrochureSchema,
} from "./validation.js"

type ProductMediaListQuery = z.infer<typeof productMediaListQuerySchema>
type CreateProductMediaInput = z.infer<typeof insertProductMediaSchema>
type UpdateProductMediaInput = z.infer<typeof updateProductMediaSchema>
type UpsertProductBrochureInput = z.infer<typeof upsertProductBrochureSchema>
type ReorderProductMediaInput = z.infer<typeof reorderProductMediaSchema>

export class ProductOpenGraphMediaError extends Error {
  constructor(
    readonly code: "product_not_found" | "invalid_media_target",
    message: string,
  ) {
    super(message)
    this.name = "ProductOpenGraphMediaError"
  }
}

async function ensureProductExists(db: PostgresJsDatabase, productId: string) {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  return product ?? null
}

async function getDayById(
  db: PostgresJsDatabase,
  dayId: string,
): Promise<{ id: string; itineraryId: string; productId: string } | null> {
  const [day] = await db
    .select({
      id: productDays.id,
      itineraryId: productDays.itineraryId,
      productId: productItineraries.productId,
    })
    .from(productDays)
    .innerJoin(productItineraries, eq(productDays.itineraryId, productItineraries.id))
    .where(eq(productDays.id, dayId))
    .limit(1)

  return day ?? null
}

export const mediaProductsService = {
  // ==========================================================================
  // Product Media
  // ==========================================================================

  async listMedia(db: PostgresJsDatabase, productId: string, query: ProductMediaListQuery) {
    const conditions = [eq(productMedia.productId, productId)]

    if (query.dayId !== undefined) {
      conditions.push(eq(productMedia.dayId, query.dayId))
    }

    if (query.mediaType) {
      conditions.push(eq(productMedia.mediaType, query.mediaType))
    }

    if (query.isBrochure !== undefined) {
      conditions.push(eq(productMedia.isBrochure, query.isBrochure))
    }

    if (query.isBrochureCurrent !== undefined) {
      conditions.push(eq(productMedia.isBrochureCurrent, query.isBrochureCurrent))
    }

    const where = and(...conditions)

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productMedia)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(
          desc(productMedia.isCover),
          asc(productMedia.sortOrder),
          asc(productMedia.createdAt),
        ),
      db.select({ count: sql<number>`count(*)::int` }).from(productMedia).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async listProductLevelMedia(
    db: PostgresJsDatabase,
    productId: string,
    query: ProductMediaListQuery,
  ) {
    // agent-quality: raw-sql reviewed -- owner: inventory; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    const conditions = [eq(productMedia.productId, productId), sql`${productMedia.dayId} is null`]

    if (query.mediaType) {
      conditions.push(eq(productMedia.mediaType, query.mediaType))
    }

    if (query.isBrochure !== undefined) {
      conditions.push(eq(productMedia.isBrochure, query.isBrochure))
    }

    if (query.isBrochureCurrent !== undefined) {
      conditions.push(eq(productMedia.isBrochureCurrent, query.isBrochureCurrent))
    }

    const where = and(...conditions)

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productMedia)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(
          desc(productMedia.isCover),
          asc(productMedia.sortOrder),
          asc(productMedia.createdAt),
        ),
      db.select({ count: sql<number>`count(*)::int` }).from(productMedia).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getMediaById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(productMedia).where(eq(productMedia.id, id)).limit(1)
    return row ?? null
  },

  async createMedia(db: PostgresJsDatabase, productId: string, data: CreateProductMediaInput) {
    const product = await ensureProductExists(db, productId)
    if (!product) {
      return null
    }

    if (data.dayId) {
      if (data.isBrochure) {
        return null
      }

      const day = await getDayById(db, data.dayId)

      if (!day || day.productId !== productId) {
        return null
      }
    }

    if (data.isBrochure) {
      await db
        .update(productMedia)
        .set({ isBrochureCurrent: false, updatedAt: new Date() })
        .where(
          and(
            eq(productMedia.productId, productId),
            eq(productMedia.isBrochure, true),
            // agent-quality: raw-sql reviewed -- owner: inventory; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
            sql`${productMedia.dayId} is null`,
          ),
        )
    }

    const [row] = await db
      .insert(productMedia)
      .values({
        productId,
        dayId: data.dayId ?? null,
        mediaType: data.mediaType,
        name: data.name,
        url: data.url,
        storageKey: data.storageKey ?? null,
        mimeType: data.mimeType ?? null,
        fileSize: data.fileSize ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
        altText: data.altText ?? null,
        assetId: data.assetId ?? null,
        sortOrder: data.sortOrder,
        isCover: data.isCover,
        isBrochure: data.isBrochure,
        isBrochureCurrent: data.isBrochureCurrent,
        brochureVersion: data.brochureVersion ?? null,
      })
      .returning()

    return row ?? null
  },

  async updateMedia(db: PostgresJsDatabase, id: string, data: UpdateProductMediaInput) {
    const existing = await mediaProductsService.getMediaById(db, id)
    if (!existing) {
      return null
    }

    if (data.isBrochure === true && existing.dayId) {
      return null
    }

    if (data.isBrochure === true) {
      await db
        .update(productMedia)
        .set({ isBrochureCurrent: false, updatedAt: new Date() })
        .where(
          and(
            eq(productMedia.productId, existing.productId),
            eq(productMedia.isBrochure, true),
            // agent-quality: raw-sql reviewed -- owner: inventory; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
            sql`${productMedia.dayId} is null`,
            // agent-quality: raw-sql reviewed -- owner: inventory; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
            sql`${productMedia.id} <> ${id}`,
          ),
        )
    }

    const [row] = await db
      .update(productMedia)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productMedia.id, id))
      .returning()

    return row ?? null
  },

  async deleteMedia(db: PostgresJsDatabase, id: string) {
    const [row] = await db.delete(productMedia).where(eq(productMedia.id, id)).returning()

    return row ?? null
  },

  async setCoverMedia(
    db: PostgresJsDatabase,
    productId: string,
    mediaId: string,
    dayId?: string | null,
  ) {
    const target = await mediaProductsService.getMediaById(db, mediaId)
    if (
      !target ||
      target.productId !== productId ||
      target.mediaType !== "image" ||
      (dayId ? target.dayId !== dayId : target.dayId !== null)
    ) {
      return null
    }

    // Unset existing cover in the same scope (product-level or day-level)
    const scopeConditions = [eq(productMedia.productId, productId)]
    if (dayId) {
      scopeConditions.push(eq(productMedia.dayId, dayId))
    } else {
      // agent-quality: raw-sql reviewed -- owner: inventory; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      scopeConditions.push(sql`${productMedia.dayId} is null`)
    }

    await db
      .update(productMedia)
      .set({ isCover: false, updatedAt: new Date() })
      .where(and(...scopeConditions))

    const [row] = await db
      .update(productMedia)
      .set({ isCover: true, updatedAt: new Date() })
      .where(eq(productMedia.id, mediaId))
      .returning()

    return row ?? null
  },

  async setOpenGraphMedia(db: PostgresJsDatabase, productId: string, mediaId: string | null) {
    return db.transaction(async (tx) => {
      // Lock the owning product to serialize replacements for one product. This
      // prevents concurrent requests from racing the partial unique index.
      const [product] = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, productId))
        .for("update")
        .limit(1)
      if (!product) {
        throw new ProductOpenGraphMediaError("product_not_found", "Product not found")
      }

      if (mediaId === null) {
        await tx
          .update(productMedia)
          .set({ isOpenGraph: false, updatedAt: new Date() })
          .where(and(eq(productMedia.productId, productId), eq(productMedia.isOpenGraph, true)))
        return null
      }

      const [target] = await tx
        .select()
        .from(productMedia)
        .where(
          and(
            eq(productMedia.id, mediaId),
            eq(productMedia.productId, productId),
            eq(productMedia.mediaType, "image"),
            eq(productMedia.isBrochure, false),
            // agent-quality: raw-sql reviewed -- owner: inventory; product-level media has no day.
            sql`${productMedia.dayId} is null`,
          ),
        )
        .for("update")
        .limit(1)
      if (!target) {
        throw new ProductOpenGraphMediaError(
          "invalid_media_target",
          "Open Graph media must be a product-level image owned by this product",
        )
      }

      await tx
        .update(productMedia)
        .set({ isOpenGraph: false, updatedAt: new Date() })
        .where(and(eq(productMedia.productId, productId), eq(productMedia.isOpenGraph, true)))

      const [row] = await tx
        .update(productMedia)
        .set({ isOpenGraph: true, updatedAt: new Date() })
        .where(and(eq(productMedia.id, mediaId), eq(productMedia.productId, productId)))
        .returning()
      if (!row) {
        throw new ProductOpenGraphMediaError(
          "invalid_media_target",
          "Open Graph media target no longer exists",
        )
      }

      return row
    })
  },

  async reorderMedia(db: PostgresJsDatabase, data: ReorderProductMediaInput) {
    const results = await Promise.all(
      data.items.map(async (item) => {
        const [row] = await db
          .update(productMedia)
          .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
          .where(eq(productMedia.id, item.id))
          .returning({ id: productMedia.id })

        return row
      }),
    )

    return results.filter((r) => r != null)
  },

  async getBrochure(db: PostgresJsDatabase, productId: string) {
    const [row] = await db
      .select()
      .from(productMedia)
      .where(
        and(
          eq(productMedia.productId, productId),
          eq(productMedia.isBrochure, true),
          eq(productMedia.isBrochureCurrent, true),
          // agent-quality: raw-sql reviewed -- owner: inventory; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
          sql`${productMedia.dayId} is null`,
        ),
      )
      .orderBy(
        desc(productMedia.brochureVersion),
        desc(productMedia.updatedAt),
        desc(productMedia.createdAt),
      )
      .limit(1)

    return row ?? null
  },

  async listBrochures(db: PostgresJsDatabase, productId: string) {
    return db
      .select()
      .from(productMedia)
      .where(
        and(
          eq(productMedia.productId, productId),
          eq(productMedia.isBrochure, true),
          // agent-quality: raw-sql reviewed -- owner: inventory; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
          sql`${productMedia.dayId} is null`,
        ),
      )
      .orderBy(
        desc(productMedia.isBrochureCurrent),
        desc(productMedia.brochureVersion),
        desc(productMedia.updatedAt),
        desc(productMedia.createdAt),
      )
  },

  async upsertBrochure(
    db: PostgresJsDatabase,
    productId: string,
    data: UpsertProductBrochureInput,
  ) {
    const product = await ensureProductExists(db, productId)
    if (!product) {
      return null
    }

    const brochures = await mediaProductsService.listBrochures(db, productId)
    const nextVersion =
      brochures.reduce((maxVersion, brochure) => {
        const version = brochure.brochureVersion ?? 0
        return version > maxVersion ? version : maxVersion
      }, 0) + 1

    return mediaProductsService.createMedia(db, productId, {
      mediaType: "document",
      dayId: null,
      name: data.name,
      url: data.url,
      storageKey: data.storageKey ?? null,
      mimeType: data.mimeType ?? "application/pdf",
      fileSize: data.fileSize ?? null,
      altText: data.altText ?? null,
      sortOrder: data.sortOrder,
      isCover: false,
      isBrochure: true,
      isBrochureCurrent: true,
      brochureVersion: nextVersion,
    })
  },

  async deleteBrochure(db: PostgresJsDatabase, productId: string) {
    const brochure = await mediaProductsService.getBrochure(db, productId)
    if (!brochure) {
      return null
    }

    const [row] = await db.delete(productMedia).where(eq(productMedia.id, brochure.id)).returning()

    const [previous] = await db
      .select()
      .from(productMedia)
      .where(
        and(
          eq(productMedia.productId, productId),
          eq(productMedia.isBrochure, true),
          // agent-quality: raw-sql reviewed -- owner: inventory; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
          sql`${productMedia.dayId} is null`,
        ),
      )
      .orderBy(
        desc(productMedia.brochureVersion),
        desc(productMedia.updatedAt),
        desc(productMedia.createdAt),
      )
      .limit(1)

    if (previous) {
      await db
        .update(productMedia)
        .set({ isBrochureCurrent: true, updatedAt: new Date() })
        .where(eq(productMedia.id, previous.id))
    }

    return row ?? null
  },

  async setCurrentBrochure(db: PostgresJsDatabase, productId: string, brochureId: string) {
    const [brochure] = await db
      .select()
      .from(productMedia)
      .where(
        and(
          eq(productMedia.id, brochureId),
          eq(productMedia.productId, productId),
          eq(productMedia.isBrochure, true),
          // agent-quality: raw-sql reviewed -- owner: inventory; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
          sql`${productMedia.dayId} is null`,
        ),
      )
      .limit(1)

    if (!brochure) {
      return null
    }

    await db
      .update(productMedia)
      .set({ isBrochureCurrent: false, updatedAt: new Date() })
      .where(
        and(
          eq(productMedia.productId, productId),
          eq(productMedia.isBrochure, true),
          // agent-quality: raw-sql reviewed -- owner: inventory; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
          sql`${productMedia.dayId} is null`,
        ),
      )

    const [row] = await db
      .update(productMedia)
      .set({ isBrochureCurrent: true, updatedAt: new Date() })
      .where(eq(productMedia.id, brochureId))
      .returning()

    return row ?? null
  },

  async deleteBrochureVersion(db: PostgresJsDatabase, productId: string, brochureId: string) {
    const [brochure] = await db
      .select()
      .from(productMedia)
      .where(
        and(
          eq(productMedia.id, brochureId),
          eq(productMedia.productId, productId),
          eq(productMedia.isBrochure, true),
          // agent-quality: raw-sql reviewed -- owner: inventory; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
          sql`${productMedia.dayId} is null`,
        ),
      )
      .limit(1)

    if (!brochure) {
      return null
    }

    const [row] = await db.delete(productMedia).where(eq(productMedia.id, brochureId)).returning()

    if (brochure.isBrochureCurrent) {
      const [previous] = await db
        .select()
        .from(productMedia)
        .where(
          and(
            eq(productMedia.productId, productId),
            eq(productMedia.isBrochure, true),
            // agent-quality: raw-sql reviewed -- owner: inventory; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
            sql`${productMedia.dayId} is null`,
          ),
        )
        .orderBy(
          desc(productMedia.brochureVersion),
          desc(productMedia.updatedAt),
          desc(productMedia.createdAt),
        )
        .limit(1)

      if (previous) {
        await db
          .update(productMedia)
          .set({ isBrochureCurrent: true, updatedAt: new Date() })
          .where(eq(productMedia.id, previous.id))
      }
    }

    return row ?? null
  },
}

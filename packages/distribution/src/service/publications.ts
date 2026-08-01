import type { EventBus } from "@voyant-travel/core"
import { RequestValidationError } from "@voyant-travel/hono"
import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { emitProductPublicationChanged } from "../events.js"
import { publicationProductsRef } from "../publication-product-ref.js"
import { resolveEffectivePublication } from "../publication-resolver.js"
import {
  channelProductPublications,
  channelPublicationReindexIntents,
  channelSupplierPublications,
  channels,
} from "../schema.js"
import { ensureSupplierExists } from "../suppliers/service-shared.js"
import { paginate } from "./helpers.js"
import type {
  ChannelProductPublicationListQuery,
  ChannelSupplierPublicationListQuery,
  CreateChannelProductPublicationInput,
  CreateChannelSupplierPublicationInput,
  EffectivePublicationInput,
  PreviewChannelSupplierPublicationInput,
  UpdateChannelProductPublicationInput,
  UpdateChannelSupplierPublicationInput,
} from "./types.js"

async function readChannelStatus(db: PostgresJsDatabase, channelId: string) {
  const [channel] = await db
    .select({ id: channels.id, status: channels.status })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1)
  return channel ?? null
}

async function requireChannel(db: PostgresJsDatabase, channelId: string) {
  const channel = await readChannelStatus(db, channelId)
  if (!channel) {
    throw new RequestValidationError("Channel not found", {
      fields: { channelId: ["Channel not found"] },
    })
  }
  return channel
}

async function readProductSupplierId(db: PostgresJsDatabase, productId: string) {
  const [row] = await db
    .select({ id: publicationProductsRef.id, supplierId: publicationProductsRef.supplierId })
    .from(publicationProductsRef)
    .where(eq(publicationProductsRef.id, productId))
    .limit(1)
  return row?.supplierId ?? null
}

async function requireProduct(db: PostgresJsDatabase, productId: string) {
  const [row] = await db
    .select({ id: publicationProductsRef.id })
    .from(publicationProductsRef)
    .where(eq(publicationProductsRef.id, productId))
    .limit(1)
  if (!row) {
    throw new RequestValidationError("Product not found", {
      fields: { productId: ["Product not found"] },
    })
  }
}

async function enqueueProductPublicationReindex(
  db: PostgresJsDatabase,
  input: { channelId: string; productId: string; requestedBy?: string | null },
) {
  await db
    .insert(channelPublicationReindexIntents)
    .values({
      channelId: input.channelId,
      kind: "product",
      productId: input.productId,
      requestedBy: input.requestedBy ?? null,
    })
    .onConflictDoNothing()
}

async function enqueueSupplierPublicationReindex(
  db: PostgresJsDatabase,
  input: { channelId: string; supplierId: string; requestedBy?: string | null },
) {
  await db
    .insert(channelPublicationReindexIntents)
    .values({
      channelId: input.channelId,
      kind: "supplier",
      supplierId: input.supplierId,
      requestedBy: input.requestedBy ?? null,
    })
    .onConflictDoNothing()
}

async function emitPublicationChanged(
  eventBus: EventBus | undefined,
  db: PostgresJsDatabase,
  input: {
    channelId: string
    productId: string
    publicationId: string | null
    operation: "created" | "updated" | "deleted"
  },
) {
  await emitProductPublicationChanged(eventBus, db, {
    channelId: input.channelId,
    productId: input.productId,
    publicationId: input.publicationId,
    operation: input.operation,
  })
}

export const publicationServiceOperations = {
  async listProductPublications(db: PostgresJsDatabase, query: ChannelProductPublicationListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelProductPublications.channelId, query.channelId))
    if (query.productId) conditions.push(eq(channelProductPublications.productId, query.productId))
    if (query.decision) conditions.push(eq(channelProductPublications.decision, query.decision))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelProductPublications)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelProductPublications.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelProductPublications)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getProductPublicationById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelProductPublications)
      .where(eq(channelProductPublications.id, id))
      .limit(1)
    return row ?? null
  },

  async getProductPublicationForSubject(
    db: PostgresJsDatabase,
    input: { channelId: string; productId: string },
  ) {
    const [row] = await db
      .select()
      .from(channelProductPublications)
      .where(
        and(
          eq(channelProductPublications.channelId, input.channelId),
          eq(channelProductPublications.productId, input.productId),
        ),
      )
      .limit(1)
    return row ?? null
  },

  async upsertProductPublication(
    db: PostgresJsDatabase,
    data: CreateChannelProductPublicationInput,
    options: { eventBus?: EventBus; actorId?: string | null } = {},
  ) {
    await requireChannel(db, data.channelId)
    await requireProduct(db, data.productId)
    const now = new Date()
    const actorId = data.updatedBy ?? options.actorId ?? null
    const existing = await publicationServiceOperations.getProductPublicationForSubject(db, data)
    const [row] = await db
      .insert(channelProductPublications)
      .values({
        ...data,
        createdBy: data.createdBy ?? actorId,
        updatedBy: actorId,
      })
      .onConflictDoUpdate({
        target: [channelProductPublications.channelId, channelProductPublications.productId],
        set: {
          decision: data.decision,
          reason: data.reason ?? null,
          updatedBy: actorId,
          metadata: data.metadata ?? null,
          updatedAt: now,
        },
      })
      .returning()
    await enqueueProductPublicationReindex(db, {
      channelId: data.channelId,
      productId: data.productId,
      requestedBy: actorId,
    })
    await emitPublicationChanged(options.eventBus, db, {
      channelId: data.channelId,
      productId: data.productId,
      publicationId: row?.id ?? null,
      operation: existing ? "updated" : "created",
    })
    return row!
  },

  async updateProductPublication(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelProductPublicationInput,
    options: { eventBus?: EventBus; actorId?: string | null } = {},
  ) {
    const [existing] = await db
      .select({
        channelId: channelProductPublications.channelId,
        productId: channelProductPublications.productId,
      })
      .from(channelProductPublications)
      .where(eq(channelProductPublications.id, id))
      .limit(1)
    if (!existing) return null
    const actorId = data.updatedBy ?? options.actorId ?? null
    const [row] = await db
      .update(channelProductPublications)
      .set({ ...data, updatedBy: actorId, updatedAt: new Date() })
      .where(eq(channelProductPublications.id, id))
      .returning()
    await enqueueProductPublicationReindex(db, { ...existing, requestedBy: actorId })
    await emitPublicationChanged(options.eventBus, db, {
      ...existing,
      publicationId: row?.id ?? null,
      operation: "updated",
    })
    return row ?? null
  },

  async deleteProductPublication(
    db: PostgresJsDatabase,
    id: string,
    options: { eventBus?: EventBus; actorId?: string | null } = {},
  ) {
    const [row] = await db
      .delete(channelProductPublications)
      .where(eq(channelProductPublications.id, id))
      .returning({
        id: channelProductPublications.id,
        channelId: channelProductPublications.channelId,
        productId: channelProductPublications.productId,
      })
    if (!row) return null
    await enqueueProductPublicationReindex(db, {
      channelId: row.channelId,
      productId: row.productId,
      requestedBy: options.actorId ?? null,
    })
    await emitPublicationChanged(options.eventBus, db, {
      ...row,
      publicationId: row.id,
      operation: "deleted",
    })
    return { id: row.id }
  },

  async listSupplierPublications(
    db: PostgresJsDatabase,
    query: ChannelSupplierPublicationListQuery,
  ) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelSupplierPublications.channelId, query.channelId))
    if (query.supplierId)
      conditions.push(eq(channelSupplierPublications.supplierId, query.supplierId))
    if (query.decision) conditions.push(eq(channelSupplierPublications.decision, query.decision))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelSupplierPublications)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelSupplierPublications.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelSupplierPublications)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getSupplierPublicationById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelSupplierPublications)
      .where(eq(channelSupplierPublications.id, id))
      .limit(1)
    return row ?? null
  },

  async getSupplierPublicationForSubject(
    db: PostgresJsDatabase,
    input: { channelId: string; supplierId: string },
  ) {
    const [row] = await db
      .select()
      .from(channelSupplierPublications)
      .where(
        and(
          eq(channelSupplierPublications.channelId, input.channelId),
          eq(channelSupplierPublications.supplierId, input.supplierId),
        ),
      )
      .limit(1)
    return row ?? null
  },

  async countProductsForSupplier(db: PostgresJsDatabase, supplierId: string) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(publicationProductsRef)
      .where(eq(publicationProductsRef.supplierId, supplierId))
    return row?.count ?? 0
  },

  async previewSupplierPublication(
    db: PostgresJsDatabase,
    data: PreviewChannelSupplierPublicationInput,
  ) {
    await requireChannel(db, data.channelId)
    await ensureSupplierExists(db, data.supplierId)
    const affectedProductCount = await publicationServiceOperations.countProductsForSupplier(
      db,
      data.supplierId,
    )
    return {
      input: data,
      affectedProductCount,
    }
  },

  async upsertSupplierPublication(
    db: PostgresJsDatabase,
    data: CreateChannelSupplierPublicationInput,
    options: { actorId?: string | null } = {},
  ) {
    await requireChannel(db, data.channelId)
    await ensureSupplierExists(db, data.supplierId)
    const now = new Date()
    const actorId = data.updatedBy ?? options.actorId ?? null
    const [row] = await db
      .insert(channelSupplierPublications)
      .values({
        ...data,
        createdBy: data.createdBy ?? actorId,
        updatedBy: actorId,
      })
      .onConflictDoUpdate({
        target: [channelSupplierPublications.channelId, channelSupplierPublications.supplierId],
        set: {
          decision: data.decision,
          reason: data.reason ?? null,
          updatedBy: actorId,
          metadata: data.metadata ?? null,
          updatedAt: now,
        },
      })
      .returning()
    await enqueueSupplierPublicationReindex(db, {
      channelId: data.channelId,
      supplierId: data.supplierId,
      requestedBy: actorId,
    })
    const affectedProductCount = await publicationServiceOperations.countProductsForSupplier(
      db,
      data.supplierId,
    )
    return { publication: row!, affectedProductCount }
  },

  async updateSupplierPublication(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelSupplierPublicationInput,
    options: { actorId?: string | null } = {},
  ) {
    const [existing] = await db
      .select({
        channelId: channelSupplierPublications.channelId,
        supplierId: channelSupplierPublications.supplierId,
      })
      .from(channelSupplierPublications)
      .where(eq(channelSupplierPublications.id, id))
      .limit(1)
    if (!existing) return null
    const actorId = data.updatedBy ?? options.actorId ?? null
    const [row] = await db
      .update(channelSupplierPublications)
      .set({ ...data, updatedBy: actorId, updatedAt: new Date() })
      .where(eq(channelSupplierPublications.id, id))
      .returning()
    await enqueueSupplierPublicationReindex(db, { ...existing, requestedBy: actorId })
    const affectedProductCount = await publicationServiceOperations.countProductsForSupplier(
      db,
      existing.supplierId,
    )
    return row ? { publication: row, affectedProductCount } : null
  },

  async deleteSupplierPublication(
    db: PostgresJsDatabase,
    id: string,
    options: { actorId?: string | null } = {},
  ) {
    const [row] = await db
      .delete(channelSupplierPublications)
      .where(eq(channelSupplierPublications.id, id))
      .returning({
        id: channelSupplierPublications.id,
        channelId: channelSupplierPublications.channelId,
        supplierId: channelSupplierPublications.supplierId,
      })
    if (!row) return null
    await enqueueSupplierPublicationReindex(db, {
      channelId: row.channelId,
      supplierId: row.supplierId,
      requestedBy: options.actorId ?? null,
    })
    return { id: row.id }
  },

  async getEffectivePublication(db: PostgresJsDatabase, input: EffectivePublicationInput) {
    const [channel, productRule] = await Promise.all([
      readChannelStatus(db, input.channelId),
      publicationServiceOperations.getProductPublicationForSubject(db, input),
    ])
    const canonicalSupplierId =
      input.canonicalSupplierId === undefined
        ? await readProductSupplierId(db, input.productId)
        : input.canonicalSupplierId
    const supplierRule = canonicalSupplierId
      ? await publicationServiceOperations.getSupplierPublicationForSubject(db, {
          channelId: input.channelId,
          supplierId: canonicalSupplierId,
        })
      : null

    return resolveEffectivePublication({
      channelId: input.channelId,
      productId: input.productId,
      canonicalSupplierId,
      channelStatus: channel?.status ?? null,
      productRule,
      supplierRule,
    })
  },

  async listPublicationReindexIntents(db: PostgresJsDatabase) {
    return db
      .select()
      .from(channelPublicationReindexIntents)
      .orderBy(desc(channelPublicationReindexIntents.requestedAt))
      .limit(200)
  },
}

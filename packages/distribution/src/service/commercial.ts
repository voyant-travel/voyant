import type { EventBus } from "@voyant-travel/core"
import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { classifyMappingUpdate, emitProductPublicationChanged } from "../events.js"
import {
  channelBookingLinks,
  channelCommissionRules,
  channelContracts,
  channelProductMappings,
  channelWebhookEvents,
} from "../schema.js"
import { paginate, toDateOrNull } from "./helpers.js"
import type {
  ChannelBookingLinkListQuery,
  ChannelCommissionRuleListQuery,
  ChannelContractListQuery,
  ChannelProductMappingListQuery,
  ChannelWebhookEventListQuery,
  CreateChannelBookingLinkInput,
  CreateChannelCommissionRuleInput,
  CreateChannelContractInput,
  CreateChannelProductMappingInput,
  CreateChannelWebhookEventInput,
  UpdateChannelBookingLinkInput,
  UpdateChannelCommissionRuleInput,
  UpdateChannelContractInput,
  UpdateChannelProductMappingInput,
  UpdateChannelWebhookEventInput,
} from "./types.js"

export const commercialServiceOperations = {
  async listContracts(db: PostgresJsDatabase, query: ChannelContractListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelContracts.channelId, query.channelId))
    if (query.supplierId) conditions.push(eq(channelContracts.supplierId, query.supplierId))
    if (query.status) conditions.push(eq(channelContracts.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelContracts)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelContracts.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelContracts).where(where),
      query.limit,
      query.offset,
    )
  },

  async getContractById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelContracts)
      .where(eq(channelContracts.id, id))
      .limit(1)
    return row ?? null
  },

  async createContract(db: PostgresJsDatabase, data: CreateChannelContractInput) {
    const [row] = await db.insert(channelContracts).values(data).returning()
    return row
  },

  async updateContract(db: PostgresJsDatabase, id: string, data: UpdateChannelContractInput) {
    const [row] = await db
      .update(channelContracts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelContracts.id, id))
      .returning()
    return row ?? null
  },

  async deleteContract(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelContracts)
      .where(eq(channelContracts.id, id))
      .returning({ id: channelContracts.id })
    return row ?? null
  },

  async listCommissionRules(db: PostgresJsDatabase, query: ChannelCommissionRuleListQuery) {
    const conditions = []
    if (query.contractId) conditions.push(eq(channelCommissionRules.contractId, query.contractId))
    if (query.productId) conditions.push(eq(channelCommissionRules.productId, query.productId))
    if (query.scope) conditions.push(eq(channelCommissionRules.scope, query.scope))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelCommissionRules)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelCommissionRules.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelCommissionRules).where(where),
      query.limit,
      query.offset,
    )
  },

  async getCommissionRuleById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelCommissionRules)
      .where(eq(channelCommissionRules.id, id))
      .limit(1)
    return row ?? null
  },

  async createCommissionRule(db: PostgresJsDatabase, data: CreateChannelCommissionRuleInput) {
    const [row] = await db.insert(channelCommissionRules).values(data).returning()
    return row
  },

  async updateCommissionRule(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelCommissionRuleInput,
  ) {
    const [row] = await db
      .update(channelCommissionRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelCommissionRules.id, id))
      .returning()
    return row ?? null
  },

  async deleteCommissionRule(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelCommissionRules)
      .where(eq(channelCommissionRules.id, id))
      .returning({ id: channelCommissionRules.id })
    return row ?? null
  },

  async listProductMappings(db: PostgresJsDatabase, query: ChannelProductMappingListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelProductMappings.channelId, query.channelId))
    if (query.productId) conditions.push(eq(channelProductMappings.productId, query.productId))
    if (query.active !== undefined) conditions.push(eq(channelProductMappings.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelProductMappings)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelProductMappings.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelProductMappings).where(where),
      query.limit,
      query.offset,
    )
  },

  async getProductMappingById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelProductMappings)
      .where(eq(channelProductMappings.id, id))
      .limit(1)
    return row ?? null
  },

  async createProductMapping(
    db: PostgresJsDatabase,
    data: CreateChannelProductMappingInput,
    eventBus?: EventBus,
  ) {
    const [row] = await db.insert(channelProductMappings).values(data).returning()
    if (row) {
      // Adding a mapping can make the product pass storefront listability —
      // signal so catalog integrations reindex its customer-facing slices.
      await emitProductPublicationChanged(eventBus, db, {
        productId: row.productId,
        channelId: row.channelId,
        mappingId: row.id,
        previousActive: null,
        nextActive: row.active,
        operation: "created",
      })
    }
    return row
  },

  async updateProductMapping(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelProductMappingInput,
    eventBus?: EventBus,
  ) {
    // Read the prior `active` flag so we can classify activate/deactivate vs
    // a plain field edit. Only needed when a bus is wired.
    const previous = eventBus
      ? (
          await db
            .select({ active: channelProductMappings.active })
            .from(channelProductMappings)
            .where(eq(channelProductMappings.id, id))
            .limit(1)
        )[0]
      : undefined
    const [row] = await db
      .update(channelProductMappings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelProductMappings.id, id))
      .returning()
    if (row && previous) {
      await emitProductPublicationChanged(eventBus, db, {
        productId: row.productId,
        channelId: row.channelId,
        mappingId: row.id,
        previousActive: previous.active,
        nextActive: row.active,
        operation: classifyMappingUpdate(previous.active, row.active),
      })
    }
    return row ?? null
  },

  async deleteProductMapping(db: PostgresJsDatabase, id: string, eventBus?: EventBus) {
    // Capture the row before deleting so the tombstone event carries the
    // product/channel it affected (the delete only returns the id).
    const previous = eventBus
      ? (
          await db
            .select({
              productId: channelProductMappings.productId,
              channelId: channelProductMappings.channelId,
              active: channelProductMappings.active,
            })
            .from(channelProductMappings)
            .where(eq(channelProductMappings.id, id))
            .limit(1)
        )[0]
      : undefined
    const [row] = await db
      .delete(channelProductMappings)
      .where(eq(channelProductMappings.id, id))
      .returning({ id: channelProductMappings.id })
    if (row && previous) {
      // Removing a mapping can drop the product below storefront listability —
      // signal so catalog integrations tombstone / reindex the slice.
      await emitProductPublicationChanged(eventBus, db, {
        productId: previous.productId,
        channelId: previous.channelId,
        mappingId: row.id,
        previousActive: previous.active,
        nextActive: null,
        operation: "deleted",
      })
    }
    return row ?? null
  },

  async listBookingLinks(db: PostgresJsDatabase, query: ChannelBookingLinkListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelBookingLinks.channelId, query.channelId))
    if (query.bookingId) conditions.push(eq(channelBookingLinks.bookingId, query.bookingId))
    if (query.externalBookingId)
      conditions.push(eq(channelBookingLinks.externalBookingId, query.externalBookingId))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelBookingLinks)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelBookingLinks.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelBookingLinks).where(where),
      query.limit,
      query.offset,
    )
  },

  async getBookingLinkById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelBookingLinks)
      .where(eq(channelBookingLinks.id, id))
      .limit(1)
    return row ?? null
  },

  async createBookingLink(db: PostgresJsDatabase, data: CreateChannelBookingLinkInput) {
    const [row] = await db
      .insert(channelBookingLinks)
      .values({
        ...data,
        bookedAtExternal: toDateOrNull(data.bookedAtExternal),
        lastSyncedAt: toDateOrNull(data.lastSyncedAt),
      })
      .returning()
    return row
  },

  async updateBookingLink(db: PostgresJsDatabase, id: string, data: UpdateChannelBookingLinkInput) {
    const [row] = await db
      .update(channelBookingLinks)
      .set({
        ...data,
        bookedAtExternal:
          data.bookedAtExternal === undefined ? undefined : toDateOrNull(data.bookedAtExternal),
        lastSyncedAt: data.lastSyncedAt === undefined ? undefined : toDateOrNull(data.lastSyncedAt),
        updatedAt: new Date(),
      })
      .where(eq(channelBookingLinks.id, id))
      .returning()
    return row ?? null
  },

  async deleteBookingLink(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelBookingLinks)
      .where(eq(channelBookingLinks.id, id))
      .returning({ id: channelBookingLinks.id })
    return row ?? null
  },

  async listWebhookEvents(db: PostgresJsDatabase, query: ChannelWebhookEventListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelWebhookEvents.channelId, query.channelId))
    if (query.status) conditions.push(eq(channelWebhookEvents.status, query.status))
    if (query.eventType) conditions.push(eq(channelWebhookEvents.eventType, query.eventType))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelWebhookEvents)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelWebhookEvents.receivedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelWebhookEvents).where(where),
      query.limit,
      query.offset,
    )
  },

  async getWebhookEventById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelWebhookEvents)
      .where(eq(channelWebhookEvents.id, id))
      .limit(1)
    return row ?? null
  },

  async createWebhookEvent(db: PostgresJsDatabase, data: CreateChannelWebhookEventInput) {
    const [row] = await db
      .insert(channelWebhookEvents)
      .values({
        ...data,
        receivedAt: toDateOrNull(data.receivedAt) ?? new Date(),
        processedAt: toDateOrNull(data.processedAt),
      })
      .returning()
    return row
  },

  async updateWebhookEvent(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelWebhookEventInput,
  ) {
    const [row] = await db
      .update(channelWebhookEvents)
      .set({
        ...data,
        receivedAt: data.receivedAt ? new Date(data.receivedAt) : undefined,
        processedAt: data.processedAt === undefined ? undefined : toDateOrNull(data.processedAt),
      })
      .where(eq(channelWebhookEvents.id, id))
      .returning()
    return row ?? null
  },

  async deleteWebhookEvent(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelWebhookEvents)
      .where(eq(channelWebhookEvents.id, id))
      .returning({ id: channelWebhookEvents.id })
    return row ?? null
  },
}

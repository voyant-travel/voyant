import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  channelInventoryAllotments,
  channelInventoryAllotmentTargets,
  channelInventoryReleaseRules,
} from "../schema.js"
import { paginate } from "./helpers.js"
import type {
  ChannelInventoryAllotmentListQuery,
  ChannelInventoryAllotmentTargetListQuery,
  ChannelInventoryReleaseRuleListQuery,
  CreateChannelInventoryAllotmentInput,
  CreateChannelInventoryAllotmentTargetInput,
  CreateChannelInventoryReleaseRuleInput,
  UpdateChannelInventoryAllotmentInput,
  UpdateChannelInventoryAllotmentTargetInput,
  UpdateChannelInventoryReleaseRuleInput,
} from "./types.js"

export const inventoryServiceOperations = {
  async listInventoryAllotments(db: PostgresJsDatabase, query: ChannelInventoryAllotmentListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelInventoryAllotments.channelId, query.channelId))
    if (query.contractId)
      conditions.push(eq(channelInventoryAllotments.contractId, query.contractId))
    if (query.productId) conditions.push(eq(channelInventoryAllotments.productId, query.productId))
    if (query.optionId) conditions.push(eq(channelInventoryAllotments.optionId, query.optionId))
    if (query.startTimeId)
      conditions.push(eq(channelInventoryAllotments.startTimeId, query.startTimeId))
    if (query.active !== undefined)
      conditions.push(eq(channelInventoryAllotments.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelInventoryAllotments)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelInventoryAllotments.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelInventoryAllotments)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getInventoryAllotmentById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelInventoryAllotments)
      .where(eq(channelInventoryAllotments.id, id))
      .limit(1)
    return row ?? null
  },

  async createInventoryAllotment(
    db: PostgresJsDatabase,
    data: CreateChannelInventoryAllotmentInput,
  ) {
    const [row] = await db.insert(channelInventoryAllotments).values(data).returning()
    return row
  },

  async updateInventoryAllotment(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelInventoryAllotmentInput,
  ) {
    const [row] = await db
      .update(channelInventoryAllotments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelInventoryAllotments.id, id))
      .returning()
    return row ?? null
  },

  async deleteInventoryAllotment(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelInventoryAllotments)
      .where(eq(channelInventoryAllotments.id, id))
      .returning({ id: channelInventoryAllotments.id })
    return row ?? null
  },

  async listInventoryAllotmentTargets(
    db: PostgresJsDatabase,
    query: ChannelInventoryAllotmentTargetListQuery,
  ) {
    const conditions = []
    if (query.allotmentId)
      conditions.push(eq(channelInventoryAllotmentTargets.allotmentId, query.allotmentId))
    if (query.slotId) conditions.push(eq(channelInventoryAllotmentTargets.slotId, query.slotId))
    if (query.startTimeId)
      conditions.push(eq(channelInventoryAllotmentTargets.startTimeId, query.startTimeId))
    if (query.dateLocal)
      conditions.push(eq(channelInventoryAllotmentTargets.dateLocal, query.dateLocal))
    if (query.active !== undefined)
      conditions.push(eq(channelInventoryAllotmentTargets.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelInventoryAllotmentTargets)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelInventoryAllotmentTargets.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelInventoryAllotmentTargets)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getInventoryAllotmentTargetById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelInventoryAllotmentTargets)
      .where(eq(channelInventoryAllotmentTargets.id, id))
      .limit(1)
    return row ?? null
  },

  async createInventoryAllotmentTarget(
    db: PostgresJsDatabase,
    data: CreateChannelInventoryAllotmentTargetInput,
  ) {
    const [row] = await db.insert(channelInventoryAllotmentTargets).values(data).returning()
    return row
  },

  async updateInventoryAllotmentTarget(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelInventoryAllotmentTargetInput,
  ) {
    const [row] = await db
      .update(channelInventoryAllotmentTargets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelInventoryAllotmentTargets.id, id))
      .returning()
    return row ?? null
  },

  async deleteInventoryAllotmentTarget(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelInventoryAllotmentTargets)
      .where(eq(channelInventoryAllotmentTargets.id, id))
      .returning({ id: channelInventoryAllotmentTargets.id })
    return row ?? null
  },

  async listInventoryReleaseRules(
    db: PostgresJsDatabase,
    query: ChannelInventoryReleaseRuleListQuery,
  ) {
    const conditions = []
    if (query.allotmentId)
      conditions.push(eq(channelInventoryReleaseRules.allotmentId, query.allotmentId))
    if (query.releaseMode)
      conditions.push(eq(channelInventoryReleaseRules.releaseMode, query.releaseMode))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelInventoryReleaseRules)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelInventoryReleaseRules.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelInventoryReleaseRules)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getInventoryReleaseRuleById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelInventoryReleaseRules)
      .where(eq(channelInventoryReleaseRules.id, id))
      .limit(1)
    return row ?? null
  },

  async createInventoryReleaseRule(
    db: PostgresJsDatabase,
    data: CreateChannelInventoryReleaseRuleInput,
  ) {
    const [row] = await db.insert(channelInventoryReleaseRules).values(data).returning()
    return row
  },

  async updateInventoryReleaseRule(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelInventoryReleaseRuleInput,
  ) {
    const [row] = await db
      .update(channelInventoryReleaseRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelInventoryReleaseRules.id, id))
      .returning()
    return row ?? null
  },

  async deleteInventoryReleaseRule(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelInventoryReleaseRules)
      .where(eq(channelInventoryReleaseRules.id, id))
      .returning({ id: channelInventoryReleaseRules.id })
    return row ?? null
  },
}

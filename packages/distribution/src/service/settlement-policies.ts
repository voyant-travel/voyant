import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  channelReconciliationPolicies,
  channelReleaseSchedules,
  channelRemittanceExceptions,
  channelSettlementApprovals,
  channelSettlementPolicies,
} from "../schema.js"
import { paginate, toDateOrNull } from "./helpers.js"
import type {
  ChannelReconciliationPolicyListQuery,
  ChannelReleaseScheduleListQuery,
  ChannelRemittanceExceptionListQuery,
  ChannelSettlementApprovalListQuery,
  ChannelSettlementPolicyListQuery,
  CreateChannelReconciliationPolicyInput,
  CreateChannelReleaseScheduleInput,
  CreateChannelRemittanceExceptionInput,
  CreateChannelSettlementApprovalInput,
  CreateChannelSettlementPolicyInput,
  UpdateChannelReconciliationPolicyInput,
  UpdateChannelReleaseScheduleInput,
  UpdateChannelRemittanceExceptionInput,
  UpdateChannelSettlementApprovalInput,
  UpdateChannelSettlementPolicyInput,
} from "./types.js"

export const settlementPolicyServiceOperations = {
  async listSettlementPolicies(db: PostgresJsDatabase, query: ChannelSettlementPolicyListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelSettlementPolicies.channelId, query.channelId))
    if (query.contractId)
      conditions.push(eq(channelSettlementPolicies.contractId, query.contractId))
    if (query.frequency) conditions.push(eq(channelSettlementPolicies.frequency, query.frequency))
    if (query.active !== undefined)
      conditions.push(eq(channelSettlementPolicies.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelSettlementPolicies)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelSettlementPolicies.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelSettlementPolicies).where(where),
      query.limit,
      query.offset,
    )
  },

  async getSettlementPolicyById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelSettlementPolicies)
      .where(eq(channelSettlementPolicies.id, id))
      .limit(1)
    return row ?? null
  },

  async createSettlementPolicy(db: PostgresJsDatabase, data: CreateChannelSettlementPolicyInput) {
    const [row] = await db.insert(channelSettlementPolicies).values(data).returning()
    return row
  },

  async updateSettlementPolicy(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelSettlementPolicyInput,
  ) {
    const [row] = await db
      .update(channelSettlementPolicies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelSettlementPolicies.id, id))
      .returning()
    return row ?? null
  },

  async deleteSettlementPolicy(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelSettlementPolicies)
      .where(eq(channelSettlementPolicies.id, id))
      .returning({ id: channelSettlementPolicies.id })
    return row ?? null
  },

  async listReconciliationPolicies(
    db: PostgresJsDatabase,
    query: ChannelReconciliationPolicyListQuery,
  ) {
    const conditions = []
    if (query.channelId)
      conditions.push(eq(channelReconciliationPolicies.channelId, query.channelId))
    if (query.contractId)
      conditions.push(eq(channelReconciliationPolicies.contractId, query.contractId))
    if (query.frequency)
      conditions.push(eq(channelReconciliationPolicies.frequency, query.frequency))
    if (query.active !== undefined)
      conditions.push(eq(channelReconciliationPolicies.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelReconciliationPolicies)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelReconciliationPolicies.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelReconciliationPolicies)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getReconciliationPolicyById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelReconciliationPolicies)
      .where(eq(channelReconciliationPolicies.id, id))
      .limit(1)
    return row ?? null
  },

  async createReconciliationPolicy(
    db: PostgresJsDatabase,
    data: CreateChannelReconciliationPolicyInput,
  ) {
    const [row] = await db.insert(channelReconciliationPolicies).values(data).returning()
    return row
  },

  async updateReconciliationPolicy(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelReconciliationPolicyInput,
  ) {
    const [row] = await db
      .update(channelReconciliationPolicies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelReconciliationPolicies.id, id))
      .returning()
    return row ?? null
  },

  async deleteReconciliationPolicy(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelReconciliationPolicies)
      .where(eq(channelReconciliationPolicies.id, id))
      .returning({ id: channelReconciliationPolicies.id })
    return row ?? null
  },

  async listReleaseSchedules(db: PostgresJsDatabase, query: ChannelReleaseScheduleListQuery) {
    const conditions = []
    if (query.releaseRuleId)
      conditions.push(eq(channelReleaseSchedules.releaseRuleId, query.releaseRuleId))
    if (query.scheduleKind)
      conditions.push(eq(channelReleaseSchedules.scheduleKind, query.scheduleKind))
    if (query.active !== undefined)
      conditions.push(eq(channelReleaseSchedules.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelReleaseSchedules)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelReleaseSchedules.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelReleaseSchedules).where(where),
      query.limit,
      query.offset,
    )
  },

  async getReleaseScheduleById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelReleaseSchedules)
      .where(eq(channelReleaseSchedules.id, id))
      .limit(1)
    return row ?? null
  },

  async createReleaseSchedule(db: PostgresJsDatabase, data: CreateChannelReleaseScheduleInput) {
    const [row] = await db
      .insert(channelReleaseSchedules)
      .values({
        ...data,
        nextRunAt: toDateOrNull(data.nextRunAt),
        lastRunAt: toDateOrNull(data.lastRunAt),
      })
      .returning()
    return row
  },

  async updateReleaseSchedule(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelReleaseScheduleInput,
  ) {
    const [row] = await db
      .update(channelReleaseSchedules)
      .set({
        ...data,
        nextRunAt: toDateOrNull(data.nextRunAt),
        lastRunAt: toDateOrNull(data.lastRunAt),
        updatedAt: new Date(),
      })
      .where(eq(channelReleaseSchedules.id, id))
      .returning()
    return row ?? null
  },

  async deleteReleaseSchedule(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelReleaseSchedules)
      .where(eq(channelReleaseSchedules.id, id))
      .returning({ id: channelReleaseSchedules.id })
    return row ?? null
  },

  async listRemittanceExceptions(
    db: PostgresJsDatabase,
    query: ChannelRemittanceExceptionListQuery,
  ) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelRemittanceExceptions.channelId, query.channelId))
    if (query.settlementItemId)
      conditions.push(eq(channelRemittanceExceptions.settlementItemId, query.settlementItemId))
    if (query.reconciliationItemId)
      conditions.push(
        eq(channelRemittanceExceptions.reconciliationItemId, query.reconciliationItemId),
      )
    if (query.status) conditions.push(eq(channelRemittanceExceptions.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelRemittanceExceptions)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelRemittanceExceptions.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelRemittanceExceptions)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getRemittanceExceptionById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelRemittanceExceptions)
      .where(eq(channelRemittanceExceptions.id, id))
      .limit(1)
    return row ?? null
  },

  async createRemittanceException(
    db: PostgresJsDatabase,
    data: CreateChannelRemittanceExceptionInput,
  ) {
    const [row] = await db
      .insert(channelRemittanceExceptions)
      .values({
        ...data,
        openedAt: toDateOrNull(data.openedAt) ?? new Date(),
        resolvedAt: toDateOrNull(data.resolvedAt),
      })
      .returning()
    return row
  },

  async updateRemittanceException(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelRemittanceExceptionInput,
  ) {
    const [row] = await db
      .update(channelRemittanceExceptions)
      .set({
        ...data,
        openedAt: data.openedAt ? new Date(data.openedAt) : undefined,
        resolvedAt: toDateOrNull(data.resolvedAt),
        updatedAt: new Date(),
      })
      .where(eq(channelRemittanceExceptions.id, id))
      .returning()
    return row ?? null
  },

  async deleteRemittanceException(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelRemittanceExceptions)
      .where(eq(channelRemittanceExceptions.id, id))
      .returning({ id: channelRemittanceExceptions.id })
    return row ?? null
  },

  async listSettlementApprovals(db: PostgresJsDatabase, query: ChannelSettlementApprovalListQuery) {
    const conditions = []
    if (query.settlementRunId)
      conditions.push(eq(channelSettlementApprovals.settlementRunId, query.settlementRunId))
    if (query.status) conditions.push(eq(channelSettlementApprovals.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelSettlementApprovals)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelSettlementApprovals.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelSettlementApprovals)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getSettlementApprovalById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelSettlementApprovals)
      .where(eq(channelSettlementApprovals.id, id))
      .limit(1)
    return row ?? null
  },

  async createSettlementApproval(
    db: PostgresJsDatabase,
    data: CreateChannelSettlementApprovalInput,
  ) {
    const [row] = await db
      .insert(channelSettlementApprovals)
      .values({
        ...data,
        decidedAt: toDateOrNull(data.decidedAt),
      })
      .returning()
    return row
  },

  async updateSettlementApproval(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelSettlementApprovalInput,
  ) {
    const [row] = await db
      .update(channelSettlementApprovals)
      .set({
        ...data,
        decidedAt: toDateOrNull(data.decidedAt),
        updatedAt: new Date(),
      })
      .where(eq(channelSettlementApprovals.id, id))
      .returning()
    return row ?? null
  },

  async deleteSettlementApproval(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelSettlementApprovals)
      .where(eq(channelSettlementApprovals.id, id))
      .returning({ id: channelSettlementApprovals.id })
    return row ?? null
  },
}

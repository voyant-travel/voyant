import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import {
  resourceCloseouts,
  resourcePoolMembers,
  resourcePools,
  resourceRequirements,
  resourceSlotAssignments,
  resources,
} from "./schema.js"
import type {
  insertResourceCloseoutSchema,
  insertResourcePoolMemberSchema,
  insertResourcePoolSchema,
  insertResourceRequirementSchema,
  insertResourceSchema,
  insertResourceSlotAssignmentSchema,
  resourceCloseoutListQuerySchema,
  resourceListQuerySchema,
  resourcePoolListQuerySchema,
  resourcePoolMemberListQuerySchema,
  resourceRequirementListQuerySchema,
  resourceSlotAssignmentListQuerySchema,
  updateResourceCloseoutSchema,
  updateResourcePoolSchema,
  updateResourceRequirementSchema,
  updateResourceSchema,
  updateResourceSlotAssignmentSchema,
} from "./validation.js"

type ResourceListQuery = z.infer<typeof resourceListQuerySchema>
type ResourcePoolListQuery = z.infer<typeof resourcePoolListQuerySchema>
type ResourcePoolMemberListQuery = z.infer<typeof resourcePoolMemberListQuerySchema>
type ResourceRequirementListQuery = z.infer<typeof resourceRequirementListQuerySchema>
type ResourceSlotAssignmentListQuery = z.infer<typeof resourceSlotAssignmentListQuerySchema>
type ResourceCloseoutListQuery = z.infer<typeof resourceCloseoutListQuerySchema>
type CreateResourceInput = z.infer<typeof insertResourceSchema>
type UpdateResourceInput = z.infer<typeof updateResourceSchema>
type CreateResourcePoolInput = z.infer<typeof insertResourcePoolSchema>
type UpdateResourcePoolInput = z.infer<typeof updateResourcePoolSchema>
type CreateResourcePoolMemberInput = z.infer<typeof insertResourcePoolMemberSchema>
type CreateResourceRequirementInput = z.infer<typeof insertResourceRequirementSchema>
type UpdateResourceRequirementInput = z.infer<typeof updateResourceRequirementSchema>
type CreateResourceSlotAssignmentInput = z.infer<typeof insertResourceSlotAssignmentSchema>
type UpdateResourceSlotAssignmentInput = z.infer<typeof updateResourceSlotAssignmentSchema>
type CreateResourceCloseoutInput = z.infer<typeof insertResourceCloseoutSchema>
type UpdateResourceCloseoutInput = z.infer<typeof updateResourceCloseoutSchema>

async function paginate<T extends object>(
  rowsQuery: Promise<T[]>,
  countQuery: Promise<Array<{ count: number }>>,
  limit: number,
  offset: number,
) {
  const [data, countResult] = await Promise.all([rowsQuery, countQuery])
  return { data, total: countResult[0]?.count ?? 0, limit, offset }
}

function toDateOrNull(value: string | null | undefined) {
  return value ? new Date(value) : null
}

export const resourcesService = {
  async listResources(db: PostgresJsDatabase, query: ResourceListQuery) {
    const conditions = []
    if (query.supplierId) conditions.push(eq(resources.supplierId, query.supplierId))
    if (query.facilityId) conditions.push(eq(resources.facilityId, query.facilityId))
    if (query.kind) conditions.push(eq(resources.kind, query.kind))
    if (query.active !== undefined) conditions.push(eq(resources.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined

    return paginate(
      db
        .select()
        .from(resources)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(resources.createdAt),
      db.select({ count: sql<number>`count(*)::int` }).from(resources).where(where),
      query.limit,
      query.offset,
    )
  },

  async getResourceById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(resources).where(eq(resources.id, id)).limit(1)
    return row ?? null
  },

  async createResource(db: PostgresJsDatabase, data: CreateResourceInput) {
    const [row] = await db.insert(resources).values(data).returning()
    return row
  },

  async updateResource(db: PostgresJsDatabase, id: string, data: UpdateResourceInput) {
    const [row] = await db
      .update(resources)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(resources.id, id))
      .returning()
    return row ?? null
  },

  async deleteResource(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(resources)
      .where(eq(resources.id, id))
      .returning({ id: resources.id })
    return row ?? null
  },

  async listPools(db: PostgresJsDatabase, query: ResourcePoolListQuery) {
    const conditions = []
    if (query.productId) conditions.push(eq(resourcePools.productId, query.productId))
    if (query.kind) conditions.push(eq(resourcePools.kind, query.kind))
    if (query.active !== undefined) conditions.push(eq(resourcePools.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined

    return paginate(
      db
        .select()
        .from(resourcePools)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(resourcePools.createdAt),
      db.select({ count: sql<number>`count(*)::int` }).from(resourcePools).where(where),
      query.limit,
      query.offset,
    )
  },

  async getPoolById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(resourcePools).where(eq(resourcePools.id, id)).limit(1)
    return row ?? null
  },

  async createPool(db: PostgresJsDatabase, data: CreateResourcePoolInput) {
    const [row] = await db.insert(resourcePools).values(data).returning()
    return row
  },

  async updatePool(db: PostgresJsDatabase, id: string, data: UpdateResourcePoolInput) {
    const [row] = await db
      .update(resourcePools)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(resourcePools.id, id))
      .returning()
    return row ?? null
  },

  async deletePool(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(resourcePools)
      .where(eq(resourcePools.id, id))
      .returning({ id: resourcePools.id })
    return row ?? null
  },

  async listPoolMembers(db: PostgresJsDatabase, query: ResourcePoolMemberListQuery) {
    const conditions = []
    if (query.poolId) conditions.push(eq(resourcePoolMembers.poolId, query.poolId))
    if (query.resourceId) conditions.push(eq(resourcePoolMembers.resourceId, query.resourceId))
    const where = conditions.length ? and(...conditions) : undefined

    return paginate(
      db
        .select()
        .from(resourcePoolMembers)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(resourcePoolMembers.createdAt),
      db.select({ count: sql<number>`count(*)::int` }).from(resourcePoolMembers).where(where),
      query.limit,
      query.offset,
    )
  },

  async createPoolMember(db: PostgresJsDatabase, data: CreateResourcePoolMemberInput) {
    const [row] = await db.insert(resourcePoolMembers).values(data).returning()
    return row
  },

  async deletePoolMember(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(resourcePoolMembers)
      .where(eq(resourcePoolMembers.id, id))
      .returning({ id: resourcePoolMembers.id })
    return row ?? null
  },

  async listRequirements(db: PostgresJsDatabase, query: ResourceRequirementListQuery) {
    const conditions = []
    if (query.poolId) conditions.push(eq(resourceRequirements.poolId, query.poolId))
    if (query.productId) conditions.push(eq(resourceRequirements.productId, query.productId))
    if (query.availabilityRuleId)
      conditions.push(eq(resourceRequirements.availabilityRuleId, query.availabilityRuleId))
    if (query.startTimeId) conditions.push(eq(resourceRequirements.startTimeId, query.startTimeId))
    const where = conditions.length ? and(...conditions) : undefined

    return paginate(
      db
        .select()
        .from(resourceRequirements)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(resourceRequirements.priority, resourceRequirements.createdAt),
      db.select({ count: sql<number>`count(*)::int` }).from(resourceRequirements).where(where),
      query.limit,
      query.offset,
    )
  },

  async getRequirementById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(resourceRequirements)
      .where(eq(resourceRequirements.id, id))
      .limit(1)
    return row ?? null
  },

  async createRequirement(db: PostgresJsDatabase, data: CreateResourceRequirementInput) {
    const [row] = await db.insert(resourceRequirements).values(data).returning()
    return row
  },

  async updateRequirement(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateResourceRequirementInput,
  ) {
    const [row] = await db
      .update(resourceRequirements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(resourceRequirements.id, id))
      .returning()
    return row ?? null
  },

  async deleteRequirement(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(resourceRequirements)
      .where(eq(resourceRequirements.id, id))
      .returning({ id: resourceRequirements.id })
    return row ?? null
  },

  async listAllocations(db: PostgresJsDatabase, query: ResourceRequirementListQuery) {
    return this.listRequirements(db, query)
  },

  async getAllocationById(db: PostgresJsDatabase, id: string) {
    return this.getRequirementById(db, id)
  },

  async createAllocation(db: PostgresJsDatabase, data: CreateResourceRequirementInput) {
    return this.createRequirement(db, data)
  },

  async updateAllocation(db: PostgresJsDatabase, id: string, data: UpdateResourceRequirementInput) {
    return this.updateRequirement(db, id, data)
  },

  async deleteAllocation(db: PostgresJsDatabase, id: string) {
    return this.deleteRequirement(db, id)
  },

  async listSlotAssignments(db: PostgresJsDatabase, query: ResourceSlotAssignmentListQuery) {
    const conditions = []
    if (query.slotId) conditions.push(eq(resourceSlotAssignments.slotId, query.slotId))
    if (query.poolId) conditions.push(eq(resourceSlotAssignments.poolId, query.poolId))
    if (query.resourceId) conditions.push(eq(resourceSlotAssignments.resourceId, query.resourceId))
    if (query.bookingId) conditions.push(eq(resourceSlotAssignments.bookingId, query.bookingId))
    if (query.status) conditions.push(eq(resourceSlotAssignments.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined

    return paginate(
      db
        .select()
        .from(resourceSlotAssignments)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(resourceSlotAssignments.assignedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(resourceSlotAssignments).where(where),
      query.limit,
      query.offset,
    )
  },

  async getSlotAssignmentById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(resourceSlotAssignments)
      .where(eq(resourceSlotAssignments.id, id))
      .limit(1)
    return row ?? null
  },

  async createSlotAssignment(db: PostgresJsDatabase, data: CreateResourceSlotAssignmentInput) {
    const [row] = await db
      .insert(resourceSlotAssignments)
      .values({ ...data, releasedAt: toDateOrNull(data.releasedAt) })
      .returning()
    return row
  },

  async updateSlotAssignment(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateResourceSlotAssignmentInput,
  ) {
    const [row] = await db
      .update(resourceSlotAssignments)
      .set({
        ...data,
        releasedAt: data.releasedAt === undefined ? undefined : toDateOrNull(data.releasedAt),
      })
      .where(eq(resourceSlotAssignments.id, id))
      .returning()
    return row ?? null
  },

  async deleteSlotAssignment(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(resourceSlotAssignments)
      .where(eq(resourceSlotAssignments.id, id))
      .returning({ id: resourceSlotAssignments.id })
    return row ?? null
  },

  async listCloseouts(db: PostgresJsDatabase, query: ResourceCloseoutListQuery) {
    const conditions = []
    if (query.resourceId) conditions.push(eq(resourceCloseouts.resourceId, query.resourceId))
    if (query.dateLocal) conditions.push(eq(resourceCloseouts.dateLocal, query.dateLocal))
    const where = conditions.length ? and(...conditions) : undefined

    return paginate(
      db
        .select()
        .from(resourceCloseouts)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(resourceCloseouts.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(resourceCloseouts).where(where),
      query.limit,
      query.offset,
    )
  },

  async getCloseoutById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(resourceCloseouts)
      .where(eq(resourceCloseouts.id, id))
      .limit(1)
    return row ?? null
  },

  async createCloseout(db: PostgresJsDatabase, data: CreateResourceCloseoutInput) {
    const [row] = await db
      .insert(resourceCloseouts)
      .values({
        ...data,
        startsAt: toDateOrNull(data.startsAt),
        endsAt: toDateOrNull(data.endsAt),
      })
      .returning()
    return row
  },

  async updateCloseout(db: PostgresJsDatabase, id: string, data: UpdateResourceCloseoutInput) {
    const [row] = await db
      .update(resourceCloseouts)
      .set({
        ...data,
        startsAt: data.startsAt === undefined ? undefined : toDateOrNull(data.startsAt),
        endsAt: data.endsAt === undefined ? undefined : toDateOrNull(data.endsAt),
      })
      .where(eq(resourceCloseouts.id, id))
      .returning()
    return row ?? null
  },

  async deleteCloseout(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(resourceCloseouts)
      .where(eq(resourceCloseouts.id, id))
      .returning({ id: resourceCloseouts.id })
    return row ?? null
  },
}

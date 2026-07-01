import { listResponse } from "@voyant-travel/types"
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

export class ResourcesServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409,
  ) {
    super(message)
    this.name = "ResourcesServiceError"
  }
}

async function paginate<T extends object>(
  rowsQuery: Promise<T[]>,
  countQuery: Promise<Array<{ count: number }>>,
  limit: number,
  offset: number,
) {
  const [data, countResult] = await Promise.all([rowsQuery, countQuery])
  return listResponse(data, { total: countResult[0]?.count ?? 0, limit, offset })
}

function toDateOrNull(value: string | null | undefined) {
  return value ? new Date(value) : null
}

function toDateOrUndefined(value: string | undefined) {
  return value === undefined ? undefined : new Date(value)
}

function validateSlotAssignmentState(data: {
  poolId: string | null
  resourceId: string | null
  status: CreateResourceSlotAssignmentInput["status"]
  assignedAt: Date
  releasedAt: Date | null
}) {
  if (!data.poolId && !data.resourceId) {
    throw new ResourcesServiceError("Either poolId or resourceId is required", 400)
  }

  if (data.releasedAt && data.releasedAt < data.assignedAt) {
    throw new ResourcesServiceError("releasedAt must be after assignedAt", 400)
  }

  if (data.status === "released" && !data.releasedAt) {
    throw new ResourcesServiceError("releasedAt is required when status is released", 400)
  }

  if (data.status !== "released" && data.releasedAt) {
    throw new ResourcesServiceError("releasedAt is only allowed when status is released", 400)
  }
}

type ResourceCloseoutWindow = {
  id?: string
  resourceId: string
  dateLocal: string
  startsAt: Date | null
  endsAt: Date | null
}

function assertCloseoutWindowOrder(window: ResourceCloseoutWindow) {
  if (window.startsAt && window.endsAt && window.startsAt.getTime() >= window.endsAt.getTime()) {
    throw new ResourcesServiceError("Resource closeout startsAt must be before endsAt", 400)
  }
}

function closeoutWindowsOverlap(left: ResourceCloseoutWindow, right: ResourceCloseoutWindow) {
  const leftStartsAt = left.startsAt?.getTime() ?? Number.NEGATIVE_INFINITY
  const leftEndsAt = left.endsAt?.getTime() ?? Number.POSITIVE_INFINITY
  const rightStartsAt = right.startsAt?.getTime() ?? Number.NEGATIVE_INFINITY
  const rightEndsAt = right.endsAt?.getTime() ?? Number.POSITIVE_INFINITY

  return leftStartsAt < rightEndsAt && rightStartsAt < leftEndsAt
}

async function ensureCloseoutWindowAvailable(
  db: PostgresJsDatabase,
  window: ResourceCloseoutWindow,
  excludeId?: string,
) {
  assertCloseoutWindowOrder(window)

  const existing = await db
    .select({
      id: resourceCloseouts.id,
      resourceId: resourceCloseouts.resourceId,
      dateLocal: resourceCloseouts.dateLocal,
      startsAt: resourceCloseouts.startsAt,
      endsAt: resourceCloseouts.endsAt,
    })
    .from(resourceCloseouts)
    .where(
      and(
        eq(resourceCloseouts.resourceId, window.resourceId),
        eq(resourceCloseouts.dateLocal, window.dateLocal),
      ),
    )

  const overlapping = existing.find(
    (row) => row.id !== excludeId && closeoutWindowsOverlap(window, row),
  )
  if (overlapping) {
    throw new ResourcesServiceError("Resource closeout overlaps an existing closeout", 409)
  }
}

function isPostgresError(error: unknown, code: string, constraint?: string) {
  const candidate = error as {
    code?: unknown
    constraint?: unknown
    constraint_name?: unknown
  }
  return (
    candidate.code === code &&
    (constraint === undefined ||
      candidate.constraint === constraint ||
      candidate.constraint_name === constraint)
  )
}

async function ensurePoolExists(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select({ id: resourcePools.id })
    .from(resourcePools)
    .where(eq(resourcePools.id, id))
    .limit(1)
  if (!row) throw new ResourcesServiceError("Resource pool not found", 404)
}

async function ensureResourceExists(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(eq(resources.id, id))
    .limit(1)
  if (!row) throw new ResourcesServiceError("Resource not found", 404)
}

async function ensurePoolMemberNotExists(
  db: PostgresJsDatabase,
  data: CreateResourcePoolMemberInput,
) {
  const [row] = await db
    .select({ id: resourcePoolMembers.id })
    .from(resourcePoolMembers)
    .where(
      and(
        eq(resourcePoolMembers.poolId, data.poolId),
        eq(resourcePoolMembers.resourceId, data.resourceId),
      ),
    )
    .limit(1)
  if (row) throw new ResourcesServiceError("Resource pool member already exists", 409)
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
    await ensurePoolExists(db, data.poolId)
    await ensureResourceExists(db, data.resourceId)
    await ensurePoolMemberNotExists(db, data)
    try {
      const [row] = await db.insert(resourcePoolMembers).values(data).returning()
      return row
    } catch (error) {
      if (isPostgresError(error, "23505", "uidx_resource_pool_members_pool_resource")) {
        throw new ResourcesServiceError("Resource pool member already exists", 409)
      }
      throw error
    }
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
    await ensurePoolExists(db, data.poolId)
    const [row] = await db.insert(resourceRequirements).values(data).returning()
    return row
  },

  async updateRequirement(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateResourceRequirementInput,
  ) {
    if (data.poolId !== undefined) await ensurePoolExists(db, data.poolId)
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
    if (data.poolId) await ensurePoolExists(db, data.poolId)
    if (data.resourceId) await ensureResourceExists(db, data.resourceId)
    const assignedAt = toDateOrUndefined(data.assignedAt) ?? new Date()
    const releasedAt = toDateOrNull(data.releasedAt)
    validateSlotAssignmentState({
      poolId: data.poolId ?? null,
      resourceId: data.resourceId ?? null,
      status: data.status,
      assignedAt,
      releasedAt,
    })

    const [row] = await db
      .insert(resourceSlotAssignments)
      .values({ ...data, assignedAt, releasedAt })
      .returning()
    return row
  },

  async updateSlotAssignment(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateResourceSlotAssignmentInput,
  ) {
    if (data.poolId !== undefined && data.poolId !== null) await ensurePoolExists(db, data.poolId)
    if (data.resourceId !== undefined && data.resourceId !== null) {
      await ensureResourceExists(db, data.resourceId)
    }
    const existing = await this.getSlotAssignmentById(db, id)
    if (!existing) return null

    const assignedAt = toDateOrUndefined(data.assignedAt) ?? existing.assignedAt
    const releasedAt =
      data.releasedAt === undefined ? existing.releasedAt : toDateOrNull(data.releasedAt)
    validateSlotAssignmentState({
      poolId: data.poolId === undefined ? existing.poolId : data.poolId,
      resourceId: data.resourceId === undefined ? existing.resourceId : data.resourceId,
      status: data.status ?? existing.status,
      assignedAt,
      releasedAt,
    })

    const [row] = await db
      .update(resourceSlotAssignments)
      .set({
        ...data,
        assignedAt: toDateOrUndefined(data.assignedAt),
        releasedAt: data.releasedAt === undefined ? undefined : releasedAt,
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
    await ensureResourceExists(db, data.resourceId)
    const startsAt = toDateOrNull(data.startsAt)
    const endsAt = toDateOrNull(data.endsAt)
    await ensureCloseoutWindowAvailable(db, {
      resourceId: data.resourceId,
      dateLocal: data.dateLocal,
      startsAt,
      endsAt,
    })
    const [row] = await db
      .insert(resourceCloseouts)
      .values({
        ...data,
        startsAt,
        endsAt,
      })
      .returning()
    return row
  },

  async updateCloseout(db: PostgresJsDatabase, id: string, data: UpdateResourceCloseoutInput) {
    if (data.resourceId !== undefined) await ensureResourceExists(db, data.resourceId)
    const current = await resourcesService.getCloseoutById(db, id)
    if (!current) return null

    const startsAt = data.startsAt === undefined ? current.startsAt : toDateOrNull(data.startsAt)
    const endsAt = data.endsAt === undefined ? current.endsAt : toDateOrNull(data.endsAt)
    await ensureCloseoutWindowAvailable(
      db,
      {
        resourceId: data.resourceId ?? current.resourceId,
        dateLocal: data.dateLocal ?? current.dateLocal,
        startsAt,
        endsAt,
      },
      id,
    )

    const [row] = await db
      .update(resourceCloseouts)
      .set({
        ...data,
        startsAt: data.startsAt === undefined ? undefined : startsAt,
        endsAt: data.endsAt === undefined ? undefined : endsAt,
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

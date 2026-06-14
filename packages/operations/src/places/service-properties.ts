import { and, desc, eq, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { facilities, properties, propertyGroupMembers, propertyGroups } from "./schema.js"
import type {
  CreatePropertyGroupInput,
  CreatePropertyGroupMemberInput,
  CreatePropertyInput,
  PropertyGroupListQuery,
  PropertyGroupMemberListQuery,
  PropertyListQuery,
  UpdatePropertyGroupInput,
  UpdatePropertyGroupMemberInput,
  UpdatePropertyInput,
} from "./service-shared.js"
import { paginate } from "./service-shared.js"

export async function listProperties(db: PostgresJsDatabase, query: PropertyListQuery) {
  const conditions = []
  if (query.facilityId) conditions.push(eq(properties.facilityId, query.facilityId))
  if (query.propertyType) conditions.push(eq(properties.propertyType, query.propertyType))
  if (query.groupName) conditions.push(eq(properties.groupName, query.groupName))
  if (query.search) {
    const term = `%${query.search}%`
    conditions.push(or(ilike(properties.brandName, term), ilike(properties.groupName, term)))
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(properties)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(properties.updatedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(properties).where(where),
    query.limit,
    query.offset,
  )
}

export async function getPropertyById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(properties).where(eq(properties.id, id)).limit(1)
  return row ?? null
}

export async function createProperty(db: PostgresJsDatabase, data: CreatePropertyInput) {
  const [facility] = await db
    .select({ id: facilities.id })
    .from(facilities)
    .where(eq(facilities.id, data.facilityId))
    .limit(1)
  if (!facility) return null

  const [row] = await db.insert(properties).values(data).returning()
  return row ?? null
}

export async function updateProperty(
  db: PostgresJsDatabase,
  id: string,
  data: UpdatePropertyInput,
) {
  const [row] = await db
    .update(properties)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(properties.id, id))
    .returning()
  return row ?? null
}

export async function deleteProperty(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(properties)
    .where(eq(properties.id, id))
    .returning({ id: properties.id })
  return row ?? null
}

export async function listPropertyGroups(db: PostgresJsDatabase, query: PropertyGroupListQuery) {
  const conditions = []
  if (query.parentGroupId) conditions.push(eq(propertyGroups.parentGroupId, query.parentGroupId))
  if (query.groupType) conditions.push(eq(propertyGroups.groupType, query.groupType))
  if (query.status) conditions.push(eq(propertyGroups.status, query.status))
  if (query.search) {
    const term = `%${query.search}%`
    conditions.push(
      or(
        ilike(propertyGroups.name, term),
        ilike(propertyGroups.code, term),
        ilike(propertyGroups.brandName, term),
        ilike(propertyGroups.legalName, term),
      ),
    )
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(propertyGroups)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(propertyGroups.updatedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(propertyGroups).where(where),
    query.limit,
    query.offset,
  )
}

export async function getPropertyGroupById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(propertyGroups).where(eq(propertyGroups.id, id)).limit(1)
  return row ?? null
}

export async function createPropertyGroup(db: PostgresJsDatabase, data: CreatePropertyGroupInput) {
  const [row] = await db.insert(propertyGroups).values(data).returning()
  return row ?? null
}

export async function updatePropertyGroup(
  db: PostgresJsDatabase,
  id: string,
  data: UpdatePropertyGroupInput,
) {
  const [row] = await db
    .update(propertyGroups)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(propertyGroups.id, id))
    .returning()
  return row ?? null
}

export async function deletePropertyGroup(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(propertyGroups)
    .where(eq(propertyGroups.id, id))
    .returning({ id: propertyGroups.id })
  return row ?? null
}

export async function listPropertyGroupMembers(
  db: PostgresJsDatabase,
  query: PropertyGroupMemberListQuery,
) {
  const conditions = []
  if (query.groupId) conditions.push(eq(propertyGroupMembers.groupId, query.groupId))
  if (query.propertyId) conditions.push(eq(propertyGroupMembers.propertyId, query.propertyId))
  if (query.membershipRole) {
    conditions.push(eq(propertyGroupMembers.membershipRole, query.membershipRole))
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(propertyGroupMembers)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(propertyGroupMembers.updatedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(propertyGroupMembers).where(where),
    query.limit,
    query.offset,
  )
}

export async function getPropertyGroupMemberById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(propertyGroupMembers)
    .where(eq(propertyGroupMembers.id, id))
    .limit(1)
  return row ?? null
}

export async function createPropertyGroupMember(
  db: PostgresJsDatabase,
  data: CreatePropertyGroupMemberInput,
) {
  const [group, property] = await Promise.all([
    db
      .select({ id: propertyGroups.id })
      .from(propertyGroups)
      .where(eq(propertyGroups.id, data.groupId))
      .limit(1),
    db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.id, data.propertyId))
      .limit(1),
  ])
  if (!group[0] || !property[0]) return null

  const [row] = await db.insert(propertyGroupMembers).values(data).returning()
  return row ?? null
}

export async function updatePropertyGroupMember(
  db: PostgresJsDatabase,
  id: string,
  data: UpdatePropertyGroupMemberInput,
) {
  const [row] = await db
    .update(propertyGroupMembers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(propertyGroupMembers.id, id))
    .returning()
  return row ?? null
}

export async function deletePropertyGroupMember(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(propertyGroupMembers)
    .where(eq(propertyGroupMembers.id, id))
    .returning({ id: propertyGroupMembers.id })
  return row ?? null
}

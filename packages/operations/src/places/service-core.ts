import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { facilities, facilityAddressProjections } from "./schema.js"
import type {
  CreateFacilityInput,
  FacilityListQuery,
  UpdateFacilityInput,
} from "./service-shared.js"
import {
  formatAddress,
  hydrateFacilities,
  paginate,
  syncFacilityAddress,
} from "./service-shared.js"

export async function listFacilities(db: PostgresJsDatabase, query: FacilityListQuery) {
  const conditions = []

  if (query.kind) conditions.push(eq(facilities.kind, query.kind))
  if (query.status) conditions.push(eq(facilities.status, query.status))
  if (query.ownerType) conditions.push(eq(facilities.ownerType, query.ownerType))
  if (query.ownerId) conditions.push(eq(facilities.ownerId, query.ownerId))
  if (query.parentFacilityId)
    conditions.push(eq(facilities.parentFacilityId, query.parentFacilityId))
  if (query.country) {
    conditions.push(
      sql`exists (
        select 1
        from ${facilityAddressProjections}
        where ${facilityAddressProjections.facilityId} = ${facilities.id}
          and ${facilityAddressProjections.country} = ${query.country}
      )`,
    )
  }
  if (query.search) {
    const term = `%${query.search}%`
    conditions.push(
      sql`(
        ${facilities.name} ilike ${term}
        or ${facilities.code} ilike ${term}
        or ${facilities.description} ilike ${term}
        or exists (
          select 1
          from ${facilityAddressProjections}
          where ${facilityAddressProjections.facilityId} = ${facilities.id}
            and (
              ${facilityAddressProjections.fullText} ilike ${term}
              or ${facilityAddressProjections.line1} ilike ${term}
              or ${facilityAddressProjections.city} ilike ${term}
              or ${facilityAddressProjections.country} ilike ${term}
            )
        )
      )`,
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined
  const page = await paginate(
    db
      .select()
      .from(facilities)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(facilities.updatedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(facilities).where(where),
    query.limit,
    query.offset,
  )

  return {
    ...page,
    data: await hydrateFacilities(db, page.data),
  }
}

export async function getFacilityById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(facilities).where(eq(facilities.id, id)).limit(1)
  if (!row) return null

  const [hydrated] = await hydrateFacilities(db, [row])
  return hydrated ?? null
}

export async function createFacility(db: PostgresJsDatabase, data: CreateFacilityInput) {
  const {
    addressLine1,
    addressLine2,
    city,
    region,
    postalCode,
    country,
    latitude,
    longitude,
    ...facilityValues
  } = data

  const [row] = await db.insert(facilities).values(facilityValues).returning()
  if (!row) {
    throw new Error("Failed to create facility")
  }

  await syncFacilityAddress(db, row.id, {
    addressLine1,
    addressLine2,
    city,
    region,
    postalCode,
    country,
    latitude,
    longitude,
  })

  return {
    ...row,
    addressLine1: addressLine1 ?? null,
    addressLine2: addressLine2 ?? null,
    city: city ?? null,
    region: region ?? null,
    postalCode: postalCode ?? null,
    country: country ?? null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    address: formatAddress({
      fullText: null,
      line1: addressLine1 ?? null,
      line2: addressLine2 ?? null,
      city: city ?? null,
      region: region ?? null,
      postalCode: postalCode ?? null,
      country: country ?? null,
    }),
  }
}

export async function updateFacility(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateFacilityInput,
) {
  const existing = await getFacilityById(db, id)
  if (!existing) return null

  const {
    addressLine1,
    addressLine2,
    city,
    region,
    postalCode,
    country,
    latitude,
    longitude,
    ...facilityValues
  } = data

  const [row] = await db
    .update(facilities)
    .set({ ...facilityValues, updatedAt: new Date() })
    .where(eq(facilities.id, id))
    .returning()
  if (!row) return null

  await syncFacilityAddress(db, id, {
    addressLine1: addressLine1 ?? existing.addressLine1,
    addressLine2: addressLine2 ?? existing.addressLine2,
    city: city ?? existing.city,
    region: region ?? existing.region,
    postalCode: postalCode ?? existing.postalCode,
    country: country ?? existing.country,
    latitude: latitude ?? existing.latitude,
    longitude: longitude ?? existing.longitude,
  })

  return {
    ...row,
    addressLine1: addressLine1 ?? existing.addressLine1,
    addressLine2: addressLine2 ?? existing.addressLine2,
    city: city ?? existing.city,
    region: region ?? existing.region,
    postalCode: postalCode ?? existing.postalCode,
    country: country ?? existing.country,
    latitude: latitude ?? existing.latitude,
    longitude: longitude ?? existing.longitude,
    address: formatAddress({
      fullText: null,
      line1: addressLine1 ?? existing.addressLine1,
      line2: addressLine2 ?? existing.addressLine2,
      city: city ?? existing.city,
      region: region ?? existing.region,
      postalCode: postalCode ?? existing.postalCode,
      country: country ?? existing.country,
    }),
  }
}

export async function deleteFacility(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(facilities)
    .where(eq(facilities.id, id))
    .returning({ id: facilities.id })
  return row ?? null
}

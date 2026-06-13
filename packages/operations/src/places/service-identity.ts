import { identityService } from "@voyantjs/identity/service"
import type {
  InsertAddressForEntity,
  InsertContactPointForEntity,
  UpdateAddress as UpdateIdentityAddress,
  UpdateContactPoint as UpdateIdentityContactPoint,
} from "@voyantjs/identity/validation"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type {
  CreateFacilityContactInput,
  FacilityContactListQuery,
  UpdateFacilityContactInput,
} from "./service-shared.js"
import {
  ensureFacilityExists,
  facilityContactIdentitySource,
  facilityEntityType,
  rebuildFacilityAddressProjection,
} from "./service-shared.js"

export function listContactPoints(db: PostgresJsDatabase, facilityId: string) {
  return identityService.listContactPointsForEntity(db, facilityEntityType, facilityId)
}

export async function createContactPoint(
  db: PostgresJsDatabase,
  facilityId: string,
  data: InsertContactPointForEntity,
) {
  const facility = await ensureFacilityExists(db, facilityId)
  if (!facility) return null

  return identityService.createContactPoint(db, {
    ...data,
    entityType: facilityEntityType,
    entityId: facilityId,
  })
}

export function updateContactPoint(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateIdentityContactPoint,
) {
  return identityService.updateContactPoint(db, id, data)
}

export function deleteContactPoint(db: PostgresJsDatabase, id: string) {
  return identityService.deleteContactPoint(db, id)
}

export function listAddresses(db: PostgresJsDatabase, facilityId: string) {
  return identityService.listAddressesForEntity(db, facilityEntityType, facilityId)
}

export async function createAddress(
  db: PostgresJsDatabase,
  facilityId: string,
  data: InsertAddressForEntity,
) {
  const facility = await ensureFacilityExists(db, facilityId)
  if (!facility) return null

  const row = await identityService.createAddress(db, {
    ...data,
    entityType: facilityEntityType,
    entityId: facilityId,
  })

  await rebuildFacilityAddressProjection(db, facilityId)

  return row
}

export async function updateAddress(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateIdentityAddress,
) {
  const existing = await identityService.getAddressById(db, id)
  if (!existing) return null

  const row = await identityService.updateAddress(db, id, data)
  if (row) {
    await rebuildFacilityAddressProjection(db, row.entityId)
  }

  return row
}

export async function deleteAddress(db: PostgresJsDatabase, id: string) {
  const existing = await identityService.getAddressById(db, id)
  const row = await identityService.deleteAddress(db, id)

  if (row && existing?.entityType === facilityEntityType) {
    await rebuildFacilityAddressProjection(db, existing.entityId)
  }

  return row
}

export async function listFacilityContacts(
  db: PostgresJsDatabase,
  query: FacilityContactListQuery,
) {
  return identityService.listNamedContacts(db, {
    entityType: facilityEntityType,
    entityId: query.facilityId,
    role: query.role,
    limit: query.limit,
    offset: query.offset,
  })
}

export async function createFacilityContact(
  db: PostgresJsDatabase,
  facilityId: string,
  data: CreateFacilityContactInput,
) {
  const facility = await ensureFacilityExists(db, facilityId)
  if (!facility) return null

  return identityService.createNamedContact(db, {
    ...data,
    entityType: facilityEntityType,
    entityId: facilityId,
    metadata: {
      managedBy: facilityContactIdentitySource,
    },
  })
}

export async function updateFacilityContact(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateFacilityContactInput,
) {
  return identityService.updateNamedContact(db, id, data)
}

export async function deleteFacilityContact(db: PostgresJsDatabase, id: string) {
  return identityService.deleteNamedContact(db, id)
}

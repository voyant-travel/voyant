import { identityService } from "@voyantjs/identity/service"
import type {
  InsertAddressForEntity,
  InsertContactPointForEntity,
  InsertNamedContactForEntity,
  UpdateAddress as UpdateIdentityAddress,
  UpdateContactPoint as UpdateIdentityContactPoint,
  UpdateNamedContact as UpdateIdentityNamedContact,
} from "@voyantjs/identity/validation"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  ensureSupplierExists,
  rebuildSupplierDirectoryProjection,
  supplierEntityType,
} from "./service-shared.js"

export function listContactPoints(db: PostgresJsDatabase, supplierId: string) {
  return identityService.listContactPointsForEntity(db, supplierEntityType, supplierId)
}

export function listNamedContacts(db: PostgresJsDatabase, supplierId: string) {
  return identityService.listNamedContactsForEntity(db, supplierEntityType, supplierId)
}

export async function createNamedContact(
  db: PostgresJsDatabase,
  supplierId: string,
  data: InsertNamedContactForEntity,
) {
  const supplier = await ensureSupplierExists(db, supplierId)
  if (!supplier) {
    return null
  }

  const row = await identityService.createNamedContact(db, {
    ...data,
    entityType: supplierEntityType,
    entityId: supplierId,
  })

  if (row) {
    await rebuildSupplierDirectoryProjection(db, supplierId)
  }

  return row
}

export async function updateNamedContact(
  db: PostgresJsDatabase,
  contactId: string,
  data: UpdateIdentityNamedContact,
) {
  const row = await identityService.updateNamedContact(db, contactId, data)
  if (row?.entityType === supplierEntityType) {
    await rebuildSupplierDirectoryProjection(db, row.entityId)
  }
  return row
}

export async function deleteNamedContact(db: PostgresJsDatabase, contactId: string) {
  const existing = await identityService.getNamedContactById(db, contactId)
  const row = await identityService.deleteNamedContact(db, contactId)
  if (row && existing?.entityType === supplierEntityType) {
    await rebuildSupplierDirectoryProjection(db, existing.entityId)
  }
  return row
}

export async function createContactPoint(
  db: PostgresJsDatabase,
  supplierId: string,
  data: InsertContactPointForEntity,
) {
  const supplier = await ensureSupplierExists(db, supplierId)
  if (!supplier) {
    return null
  }

  const row = await identityService.createContactPoint(db, {
    ...data,
    entityType: supplierEntityType,
    entityId: supplierId,
  })

  if (row) {
    await rebuildSupplierDirectoryProjection(db, supplierId)
  }

  return row
}

export async function updateContactPoint(
  db: PostgresJsDatabase,
  contactPointId: string,
  data: UpdateIdentityContactPoint,
) {
  const row = await identityService.updateContactPoint(db, contactPointId, data)
  if (row?.entityType === supplierEntityType) {
    await rebuildSupplierDirectoryProjection(db, row.entityId)
  }
  return row
}

export async function deleteContactPoint(db: PostgresJsDatabase, contactPointId: string) {
  const existing = await identityService.getContactPointById(db, contactPointId)
  const row = await identityService.deleteContactPoint(db, contactPointId)
  if (row && existing?.entityType === supplierEntityType) {
    await rebuildSupplierDirectoryProjection(db, existing.entityId)
  }
  return row
}

export function listAddresses(db: PostgresJsDatabase, supplierId: string) {
  return identityService.listAddressesForEntity(db, supplierEntityType, supplierId)
}

export async function createAddress(
  db: PostgresJsDatabase,
  supplierId: string,
  data: InsertAddressForEntity,
) {
  const supplier = await ensureSupplierExists(db, supplierId)
  if (!supplier) {
    return null
  }

  const row = await identityService.createAddress(db, {
    ...data,
    entityType: supplierEntityType,
    entityId: supplierId,
  })

  if (row) {
    await rebuildSupplierDirectoryProjection(db, supplierId)
  }

  return row
}

export async function updateAddress(
  db: PostgresJsDatabase,
  addressId: string,
  data: UpdateIdentityAddress,
) {
  const row = await identityService.updateAddress(db, addressId, data)
  if (row?.entityType === supplierEntityType) {
    await rebuildSupplierDirectoryProjection(db, row.entityId)
  }
  return row
}

export async function deleteAddress(db: PostgresJsDatabase, addressId: string) {
  const existing = await identityService.getAddressById(db, addressId)
  const row = await identityService.deleteAddress(db, addressId)
  if (row && existing?.entityType === supplierEntityType) {
    await rebuildSupplierDirectoryProjection(db, existing.entityId)
  }
  return row
}

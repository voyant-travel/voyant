import {
  identityAddresses,
  identityContactPoints,
  identityNamedContacts,
} from "@voyantjs/identity/schema"
import { identityService } from "@voyantjs/identity/service"
import { and, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import type { Supplier } from "./schema.js"
import { supplierDirectoryProjections, suppliers } from "./schema.js"
import type {
  availabilityQuerySchema,
  insertAvailabilitySchema,
  insertContractSchema,
  insertRateSchema,
  insertServiceSchema,
  insertSupplierNoteSchema,
  insertSupplierSchema,
  supplierListQuerySchema,
  updateContractSchema,
  updateRateSchema,
  updateServiceSchema,
  updateSupplierSchema,
} from "./validation.js"

export type SupplierListQuery = z.infer<typeof supplierListQuerySchema>
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>
export type CreateSupplierInput = z.infer<typeof insertSupplierSchema>
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>
export type CreateServiceInput = z.infer<typeof insertServiceSchema>
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>
export type CreateRateInput = z.infer<typeof insertRateSchema>
export type UpdateRateInput = z.infer<typeof updateRateSchema>
export type CreateSupplierNoteInput = z.infer<typeof insertSupplierNoteSchema>
export type CreateAvailabilityInput = z.infer<typeof insertAvailabilitySchema>
export type CreateContractInput = z.infer<typeof insertContractSchema>
export type UpdateContractInput = z.infer<typeof updateContractSchema>

export const supplierEntityType = "supplier"
export const supplierBaseIdentitySource = "suppliers.base"
export const supplierPrimaryNamedContactSource = "suppliers.primary_contact"

export type SupplierIdentityInput = Pick<
  CreateSupplierInput,
  | "email"
  | "phone"
  | "website"
  | "address"
  | "city"
  | "country"
  | "contactName"
  | "contactEmail"
  | "contactPhone"
>

export type SupplierHydratedFields = {
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  city: string | null
  country: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
}

export type HydratedSupplier = Supplier & SupplierHydratedFields

type SupplierDirectoryProjectionValues = Omit<
  typeof supplierDirectoryProjections.$inferInsert,
  "id" | "updatedAt"
>

function normalizeContactValue(kind: "email" | "phone" | "website", value: string) {
  if (kind === "email" || kind === "website") {
    return value.trim().toLowerCase()
  }

  return value.trim()
}

function isManagedBySource(metadata: Record<string, unknown> | null | undefined, source: string) {
  return metadata?.managedBy === source
}

function toNullableTrimmed(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function formatAddress(address: {
  fullText: string | null
  line1: string | null
  line2: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  country: string | null
}) {
  if (address.fullText) {
    return address.fullText
  }

  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(", ") : null
}

export async function ensureSupplierExists(db: PostgresJsDatabase, supplierId: string) {
  const [supplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1)
  return supplier ?? null
}

function emptySupplierHydratedFields(): SupplierHydratedFields {
  return {
    email: null,
    phone: null,
    website: null,
    address: null,
    city: null,
    country: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
  }
}

async function buildSupplierDirectoryProjectionRows(
  db: PostgresJsDatabase,
  supplierIds: string[],
): Promise<SupplierDirectoryProjectionValues[]> {
  if (supplierIds.length === 0) {
    return []
  }

  const ids = [...new Set(supplierIds)]
  const [contactPoints, addresses, namedContacts] = await Promise.all([
    db
      .select()
      .from(identityContactPoints)
      .where(
        and(
          eq(identityContactPoints.entityType, supplierEntityType),
          inArray(identityContactPoints.entityId, ids),
        ),
      ),
    db
      .select()
      .from(identityAddresses)
      .where(
        and(
          eq(identityAddresses.entityType, supplierEntityType),
          inArray(identityAddresses.entityId, ids),
        ),
      ),
    db
      .select()
      .from(identityNamedContacts)
      .where(
        and(
          eq(identityNamedContacts.entityType, supplierEntityType),
          inArray(identityNamedContacts.entityId, ids),
        ),
      ),
  ])

  const contactPointMap = new Map<string, typeof contactPoints>()
  const addressMap = new Map<string, typeof addresses>()
  const namedContactMap = new Map<string, typeof namedContacts>()

  for (const point of contactPoints) {
    const bucket = contactPointMap.get(point.entityId) ?? []
    bucket.push(point)
    contactPointMap.set(point.entityId, bucket)
  }

  for (const address of addresses) {
    const bucket = addressMap.get(address.entityId) ?? []
    bucket.push(address)
    addressMap.set(address.entityId, bucket)
  }

  for (const contact of namedContacts) {
    const bucket = namedContactMap.get(contact.entityId) ?? []
    bucket.push(contact)
    namedContactMap.set(contact.entityId, bucket)
  }

  return ids.map((supplierId) => {
    const entityContactPoints = contactPointMap.get(supplierId) ?? []
    const entityAddresses = addressMap.get(supplierId) ?? []
    const entityNamedContacts = namedContactMap.get(supplierId) ?? []

    const pickContactValue = (kind: "email" | "phone" | "website") =>
      entityContactPoints.find((point) => point.kind === kind && point.isPrimary)?.value ??
      entityContactPoints.find((point) => point.kind === kind)?.value ??
      null

    const primaryAddress =
      entityAddresses.find((address) => address.isPrimary) ?? entityAddresses[0] ?? null
    const primaryContact =
      entityNamedContacts.find((contact) => contact.isPrimary) ?? entityNamedContacts[0] ?? null

    return {
      supplierId,
      email: pickContactValue("email"),
      phone: pickContactValue("phone"),
      website: pickContactValue("website"),
      address: primaryAddress ? formatAddress(primaryAddress) : null,
      city: primaryAddress?.city ?? null,
      country: primaryAddress?.country ?? null,
      contactName: primaryContact?.name ?? null,
      contactEmail: primaryContact?.email ?? null,
      contactPhone: primaryContact?.phone ?? null,
    }
  })
}

export async function rebuildSupplierDirectoryProjection(
  db: PostgresJsDatabase,
  supplierId: string,
) {
  return rebuildSupplierDirectoryProjections(db, [supplierId])
}

export async function rebuildSupplierDirectoryProjections(
  db: PostgresJsDatabase,
  supplierIds: string[],
) {
  const ids = [...new Set(supplierIds)]
  if (ids.length === 0) {
    return
  }

  const rows = await buildSupplierDirectoryProjectionRows(db, ids)
  await db
    .delete(supplierDirectoryProjections)
    .where(inArray(supplierDirectoryProjections.supplierId, ids))
  await db.insert(supplierDirectoryProjections).values(rows)
}

async function ensureSupplierDirectoryProjectionMap(db: PostgresJsDatabase, supplierIds: string[]) {
  const ids = [...new Set(supplierIds)]
  if (ids.length === 0) {
    return new Map<string, SupplierHydratedFields>()
  }

  const existing = await db
    .select()
    .from(supplierDirectoryProjections)
    .where(inArray(supplierDirectoryProjections.supplierId, ids))

  const map = new Map<string, SupplierHydratedFields>()
  for (const projection of existing) {
    map.set(projection.supplierId, {
      email: projection.email,
      phone: projection.phone,
      website: projection.website,
      address: projection.address,
      city: projection.city,
      country: projection.country,
      contactName: projection.contactName,
      contactEmail: projection.contactEmail,
      contactPhone: projection.contactPhone,
    })
  }

  const missingIds = ids.filter((id) => !map.has(id))
  if (missingIds.length > 0) {
    await rebuildSupplierDirectoryProjections(db, missingIds)
    const rebuilt = await db
      .select()
      .from(supplierDirectoryProjections)
      .where(inArray(supplierDirectoryProjections.supplierId, missingIds))

    for (const projection of rebuilt) {
      map.set(projection.supplierId, {
        email: projection.email,
        phone: projection.phone,
        website: projection.website,
        address: projection.address,
        city: projection.city,
        country: projection.country,
        contactName: projection.contactName,
        contactEmail: projection.contactEmail,
        contactPhone: projection.contactPhone,
      })
    }
  }

  for (const id of ids) {
    if (!map.has(id)) {
      map.set(id, emptySupplierHydratedFields())
    }
  }

  return map
}

export async function syncSupplierIdentity(
  db: PostgresJsDatabase,
  supplierId: string,
  data: SupplierIdentityInput,
) {
  const existingContactPoints = await identityService.listContactPointsForEntity(
    db,
    supplierEntityType,
    supplierId,
  )
  const existingAddresses = await identityService.listAddressesForEntity(
    db,
    supplierEntityType,
    supplierId,
  )
  const existingNamedContacts = await identityService.listNamedContactsForEntity(
    db,
    supplierEntityType,
    supplierId,
  )

  const managedContactPoints = existingContactPoints.filter((point) =>
    isManagedBySource(point.metadata as Record<string, unknown> | null, supplierBaseIdentitySource),
  )
  const managedAddress = existingAddresses.find((address) =>
    isManagedBySource(
      address.metadata as Record<string, unknown> | null,
      supplierBaseIdentitySource,
    ),
  )
  const managedPrimaryContact = existingNamedContacts.find((contact) =>
    isManagedBySource(
      contact.metadata as Record<string, unknown> | null,
      supplierPrimaryNamedContactSource,
    ),
  )

  for (const [kind, rawValue] of Object.entries({
    email: data.email,
    phone: data.phone,
    website: data.website,
  }) as Array<["email" | "phone" | "website", string | null | undefined]>) {
    const value = toNullableTrimmed(rawValue)
    const existing =
      managedContactPoints.find((point) => point.kind === kind) ??
      existingContactPoints.find((point) => point.kind === kind && point.isPrimary)

    if (!value) {
      if (existing) {
        await identityService.deleteContactPoint(db, existing.id)
      }
      continue
    }

    const payload = {
      entityType: supplierEntityType,
      entityId: supplierId,
      kind,
      label: kind === "website" ? "website" : "primary",
      value,
      normalizedValue: normalizeContactValue(kind, value),
      isPrimary: true,
      metadata: {
        managedBy: supplierBaseIdentitySource,
      },
    }

    if (existing) {
      await identityService.updateContactPoint(db, existing.id, payload)
    } else {
      await identityService.createContactPoint(db, payload)
    }
  }

  const addressLine = toNullableTrimmed(data.address)
  const city = toNullableTrimmed(data.city)
  const country = toNullableTrimmed(data.country)
  const hasAddress = Boolean(addressLine || city || country)

  if (!hasAddress) {
    if (managedAddress) {
      await identityService.deleteAddress(db, managedAddress.id)
    }
  } else {
    const addressPayload = {
      entityType: supplierEntityType,
      entityId: supplierId,
      label: "primary" as const,
      fullText: addressLine,
      line1: addressLine,
      city,
      country,
      isPrimary: true,
      metadata: {
        managedBy: supplierBaseIdentitySource,
      },
    }

    if (managedAddress) {
      await identityService.updateAddress(db, managedAddress.id, addressPayload)
    } else {
      await identityService.createAddress(db, addressPayload)
    }
  }

  const contactName = toNullableTrimmed(data.contactName)
  const contactEmail = toNullableTrimmed(data.contactEmail)
  const contactPhone = toNullableTrimmed(data.contactPhone)
  const hasPrimaryContact = Boolean(contactName || contactEmail || contactPhone)

  if (!hasPrimaryContact) {
    if (managedPrimaryContact) {
      await identityService.deleteNamedContact(db, managedPrimaryContact.id)
    }
    await rebuildSupplierDirectoryProjection(db, supplierId)
    return
  }

  const namedContactPayload = {
    entityType: supplierEntityType,
    entityId: supplierId,
    role: "primary" as const,
    name: contactName ?? contactEmail ?? contactPhone ?? "Primary contact",
    email: contactEmail,
    phone: contactPhone,
    isPrimary: true,
    metadata: {
      managedBy: supplierPrimaryNamedContactSource,
    },
  }

  if (managedPrimaryContact) {
    await identityService.updateNamedContact(db, managedPrimaryContact.id, namedContactPayload)
  } else {
    await identityService.createNamedContact(db, namedContactPayload)
  }

  await rebuildSupplierDirectoryProjection(db, supplierId)
}

export async function hydrateSuppliers<
  T extends {
    id: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
  },
>(db: PostgresJsDatabase, rows: T[]): Promise<Array<T & SupplierHydratedFields>> {
  if (rows.length === 0) {
    return rows.map((row) => ({ ...row, ...emptySupplierHydratedFields() }))
  }

  const ids = rows.map((row) => row.id)
  const projectionMap = await ensureSupplierDirectoryProjectionMap(db, ids)

  return rows.map((row) => {
    return {
      ...row,
      ...(projectionMap.get(row.id) ?? emptySupplierHydratedFields()),
    }
  })
}

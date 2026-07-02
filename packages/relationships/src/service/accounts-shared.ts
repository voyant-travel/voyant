import { identityService } from "@voyant-travel/identity/service"
import type {
  insertAddressForEntitySchema,
  insertAddressSchema,
  insertContactPointForEntitySchema,
  insertContactPointSchema,
  updateAddressSchema,
  updateContactPointSchema,
} from "@voyant-travel/identity/validation"
import { inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import { personDirectoryView } from "../schema.js"
import type {
  communicationListQuerySchema,
  insertCommunicationLogSchema,
  insertOrganizationNoteSchema,
  insertOrganizationSchema,
  insertPersonNoteSchema,
  insertPersonSchema,
  insertSegmentSchema,
  organizationListQuerySchema,
  personListQuerySchema,
  updateOrganizationSchema,
  updatePersonSchema,
} from "../validation.js"
import { isManagedBySource, normalizeContactValue, toNullableTrimmed } from "./helpers.js"

export type OrganizationListQuery = z.infer<typeof organizationListQuerySchema>
export type CreateOrganizationInput = z.infer<typeof insertOrganizationSchema>
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
export type PersonListQuery = z.infer<typeof personListQuerySchema>
export type CreatePersonInput = z.infer<typeof insertPersonSchema>
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>
export type CreateContactPointInput = z.infer<typeof insertContactPointSchema>
export type CreateContactPointForEntityInput = z.infer<typeof insertContactPointForEntitySchema>
export type UpdateContactPointInput = z.infer<typeof updateContactPointSchema>
export type CreateAddressInput = z.infer<typeof insertAddressSchema>
export type CreateAddressForEntityInput = z.infer<typeof insertAddressForEntitySchema>
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>
export type CreatePersonNoteInput = z.infer<typeof insertPersonNoteSchema>
export type CreateOrganizationNoteInput = z.infer<typeof insertOrganizationNoteSchema>
export type CreateCommunicationLogInput = z.infer<typeof insertCommunicationLogSchema>
export type CommunicationListQuery = z.infer<typeof communicationListQuerySchema>
export type CreateSegmentInput = z.infer<typeof insertSegmentSchema>

export const organizationEntityType = "organization"
export const personEntityType = "person"
export const personBaseIdentitySource = "relationships.person.base"

// Each field is optional: `undefined` means "leave the existing contact point
// unchanged" (partial update), `null`/empty means "clear it", a value upserts.
type PersonIdentityInput = {
  email?: string | null
  phone?: string | null
  website?: string | null
}

export type PersonHydratedFields = {
  email: string | null
  phone: string | null
  website: string | null
}

type HydratePeopleOptions = {
  fallbackOnError?: boolean
}

function emptyPersonHydratedFields(): PersonHydratedFields {
  return {
    email: null,
    phone: null,
    website: null,
  }
}

export function personBaseFields(data: CreatePersonInput | UpdatePersonInput) {
  return {
    organizationId: data.organizationId,
    firstName: data.firstName,
    middleName: data.middleName,
    lastName: data.lastName,
    gender: data.gender,
    jobTitle: data.jobTitle,
    relation: data.relation,
    preferredLanguage: data.preferredLanguage,
    preferredCurrency: data.preferredCurrency,
    ownerId: data.ownerId,
    status: data.status,
    source: data.source,
    sourceRef: data.sourceRef,
    tags: data.tags,
    customFields: data.customFields,
    dateOfBirth: data.dateOfBirth,
    notes: data.notes,
    accessibilityEncrypted: data.accessibilityEncrypted,
    dietaryEncrypted: data.dietaryEncrypted,
    loyaltyEncrypted: data.loyaltyEncrypted,
    insuranceEncrypted: data.insuranceEncrypted,
  }
}

/**
 * Reads the per-person `(email, phone, website)` triple from the
 * `person_directory` view (replaces the old projection cache —
 * see #446). The view is computed via indexed `LATERAL` joins on
 * `identity_contact_points`, so callers no longer need a rebuild
 * step after contact-point edits.
 */
async function loadPersonDirectoryMap(db: PostgresJsDatabase, personIds: string[]) {
  const ids = [...new Set(personIds)]
  if (ids.length === 0) {
    return new Map<string, PersonHydratedFields>()
  }

  const rows = await db
    .select()
    .from(personDirectoryView)
    .where(inArray(personDirectoryView.personId, ids))

  const map = new Map<string, PersonHydratedFields>()
  for (const row of rows) {
    map.set(row.personId, {
      email: row.email,
      phone: row.phone,
      website: row.website,
    })
  }
  for (const id of ids) {
    if (!map.has(id)) {
      map.set(id, emptyPersonHydratedFields())
    }
  }
  return map
}

export async function syncPersonIdentity(
  db: PostgresJsDatabase,
  personId: string,
  data: PersonIdentityInput,
) {
  const existingContactPoints = await identityService.listContactPointsForEntity(
    db,
    personEntityType,
    personId,
  )
  const existingAddresses = await identityService.listAddressesForEntity(
    db,
    personEntityType,
    personId,
  )

  const managedContactPoints = existingContactPoints.filter((point) =>
    isManagedBySource(point.metadata as Record<string, unknown> | null, personBaseIdentitySource),
  )
  const managedAddress = existingAddresses.find((address) =>
    isManagedBySource(address.metadata as Record<string, unknown> | null, personBaseIdentitySource),
  )

  for (const [kind, rawValue] of Object.entries({
    email: data.email,
    phone: data.phone,
    website: data.website,
  }) as Array<["email" | "phone" | "website", string | null | undefined]>) {
    // `undefined` means the caller did not touch this field — leave the existing
    // contact point alone. Only an explicit null / empty string clears it. This
    // keeps partial updates (PATCH) from deleting contact points the request
    // never mentioned — critical now that callers no longer backfill omitted
    // fields from a (possibly degraded) hydrated read. See issue #1971.
    if (rawValue === undefined) continue
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
      entityType: personEntityType,
      entityId: personId,
      kind,
      label: kind === "website" ? "website" : "primary",
      value,
      normalizedValue: normalizeContactValue(kind, value),
      isPrimary: true,
      metadata: { managedBy: personBaseIdentitySource },
    }

    if (existing) {
      await identityService.updateContactPoint(db, existing.id, payload)
    } else {
      await identityService.createContactPoint(db, payload)
    }
  }

  if (managedAddress) {
    await identityService.deleteAddress(db, managedAddress.id)
  }
}

export async function deletePersonIdentity(db: PostgresJsDatabase, personId: string) {
  const [contactPoints, addresses] = await Promise.all([
    identityService.listContactPointsForEntity(db, personEntityType, personId),
    identityService.listAddressesForEntity(db, personEntityType, personId),
  ])

  await Promise.all([
    ...contactPoints.map((point) => identityService.deleteContactPoint(db, point.id)),
    ...addresses.map((address) => identityService.deleteAddress(db, address.id)),
  ])
}

export async function hydratePeople<T extends { id: string }>(
  db: PostgresJsDatabase,
  rows: T[],
  options: HydratePeopleOptions = {},
): Promise<Array<T & PersonHydratedFields>> {
  const emptyHydratedRows = () =>
    rows.map((row) => ({
      ...row,
      ...emptyPersonHydratedFields(),
    }))

  if (rows.length === 0) {
    return emptyHydratedRows()
  }

  const ids = rows.map((row) => row.id)
  let directoryMap: Map<string, PersonHydratedFields>
  try {
    directoryMap = await loadPersonDirectoryMap(db, ids)
  } catch (error) {
    if (!options.fallbackOnError) {
      throw error
    }
    console.warn("[relationships] person identity hydration failed; returning base people rows", {
      error,
      personCount: rows.length,
    })
    return emptyHydratedRows()
  }

  return rows.map((row) => {
    return {
      ...row,
      ...(directoryMap.get(row.id) ?? emptyPersonHydratedFields()),
    }
  })
}

import type { KeyRef, KmsProvider } from "@voyant-travel/utils/kms"
import { decryptOptionalJsonEnvelope, encryptOptionalJsonEnvelope } from "@voyant-travel/utils/kms"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  type BookingTravelerBedPreference,
  type BookingTravelerIdentity,
  bookingTravelerAccessibilitySchema,
  bookingTravelerDietarySchema,
  bookingTravelerIdentitySchema,
  bookingTravelerTravelDetails,
  type DecryptedBookingTravelerTravelDetail,
  type TravelerAllocationMap,
} from "./schema/travel-details.js"
import { bookingTravelers } from "./schema.js"

export interface UpsertBookingTravelerTravelDetailInput {
  nationality?: string | null
  documentType?: BookingTravelerIdentity["documentType"]
  documentNumber?: string | null
  documentExpiry?: string | null
  documentIssuingCountry?: string | null
  documentIssuingAuthority?: string | null
  /** Provenance of the snapshot (id of the `crm.person_documents` row that seeded it). */
  documentPersonDocumentId?: string | null
  dateOfBirth?: string | null
  dietaryRequirements?: string | null
  accessibilityNeeds?: string | null
  isLeadTraveler?: boolean | null
  sharingGroupId?: string | null
  roomTypeId?: string | null
  bedPreference?: BookingTravelerBedPreference | null
  allocations?: TravelerAllocationMap
}

/**
 * Plaintext fields a booking-traveler can pre-fill from the
 * traveler's Relationships person record on creation. Mirrors
 * `PersonTravelSnapshot` in `@voyant-travel/relationships` so the two stay in sync.
 */
export interface BookingTravelerSnapshot {
  dateOfBirth?: string | null
  dietaryRequirements?: string | null
  accessibilityNeeds?: string | null
  documentType?: BookingTravelerIdentity["documentType"]
  documentNumber?: string | null
  documentExpiry?: string | null
  documentIssuingCountry?: string | null
  documentIssuingAuthority?: string | null
  documentPersonDocumentId?: string | null
}

/**
 * Apply a person-derived snapshot to a booking-traveler input,
 * preserving the snapshot semantic: explicit input always wins,
 * snapshot only fills the gaps. Pure (no I/O) so callers can compose
 * it freely.
 */
export function applyTravelDetailSnapshot(
  input: UpsertBookingTravelerTravelDetailInput,
  snapshot: BookingTravelerSnapshot | null | undefined,
): UpsertBookingTravelerTravelDetailInput {
  if (!snapshot) return input
  const merged: UpsertBookingTravelerTravelDetailInput = { ...input }
  const applySnapshotField = <
    K extends keyof BookingTravelerSnapshot & keyof UpsertBookingTravelerTravelDetailInput,
  >(
    key: K,
  ) => {
    if (merged[key] === undefined && snapshot[key] != null) {
      merged[key] = snapshot[key] as UpsertBookingTravelerTravelDetailInput[K]
    }
  }
  for (const key of [
    "dateOfBirth",
    "dietaryRequirements",
    "accessibilityNeeds",
    "documentType",
    "documentNumber",
    "documentExpiry",
    "documentIssuingCountry",
    "documentIssuingAuthority",
    "documentPersonDocumentId",
  ] as const) {
    applySnapshotField(key)
  }
  return merged
}

export interface BookingPiiAuditEvent {
  action: "encrypt" | "decrypt" | "delete"
  travelerId: string
  actorId?: string | null
}

export interface BookingPiiServiceOptions {
  kms: KmsProvider
  keyRef?: KeyRef
  onAudit?: (event: BookingPiiAuditEvent) => void | Promise<void>
}

export interface BookingPiiService {
  getTravelerTravelDetails(
    db: PostgresJsDatabase,
    travelerId: string,
    actorId?: string | null,
  ): Promise<DecryptedBookingTravelerTravelDetail | null>
  upsertTravelerTravelDetails(
    db: PostgresJsDatabase,
    travelerId: string,
    input: UpsertBookingTravelerTravelDetailInput,
    actorId?: string | null,
  ): Promise<DecryptedBookingTravelerTravelDetail | null>
  deleteTravelerTravelDetails(
    db: PostgresJsDatabase,
    travelerId: string,
    actorId?: string | null,
  ): Promise<{ travelerId: string } | null>
}

function buildIdentityPayload(input: UpsertBookingTravelerTravelDetailInput) {
  const hasDocumentFields =
    input.documentNumber != null ||
    input.documentExpiry != null ||
    input.documentIssuingCountry != null ||
    input.documentIssuingAuthority != null ||
    input.documentPersonDocumentId != null
  const payload = bookingTravelerIdentitySchema.parse({
    nationality: input.nationality ?? null,
    documentType: input.documentType ?? (hasDocumentFields ? "passport" : null),
    documentNumber: input.documentNumber ?? null,
    documentExpiry: input.documentExpiry ?? null,
    documentIssuingCountry: input.documentIssuingCountry ?? null,
    documentIssuingAuthority: input.documentIssuingAuthority ?? null,
    dateOfBirth: input.dateOfBirth ?? null,
  })

  if (
    !payload.nationality &&
    !payload.documentType &&
    !payload.documentNumber &&
    !payload.documentExpiry &&
    !payload.documentIssuingCountry &&
    !payload.documentIssuingAuthority &&
    !payload.dateOfBirth
  ) {
    return null
  }

  return payload
}

function buildDietaryPayload(input: UpsertBookingTravelerTravelDetailInput) {
  const payload = bookingTravelerDietarySchema.parse({
    dietaryRequirements: input.dietaryRequirements ?? null,
  })

  if (!payload.dietaryRequirements) {
    return null
  }

  return payload
}

function buildAccessibilityPayload(input: UpsertBookingTravelerTravelDetailInput) {
  const payload = bookingTravelerAccessibilitySchema.parse({
    accessibilityNeeds: input.accessibilityNeeds ?? null,
  })

  if (!payload.accessibilityNeeds) {
    return null
  }

  return payload
}

async function loadExistingTravelDetails(
  db: PostgresJsDatabase,
  travelerId: string,
  options: BookingPiiServiceOptions,
  keyRef: KeyRef,
) {
  const [row] = await db
    .select()
    .from(bookingTravelerTravelDetails)
    .where(eq(bookingTravelerTravelDetails.travelerId, travelerId))
    .limit(1)

  if (!row) {
    return null
  }

  const identity = await decryptOptionalJsonEnvelope(
    options.kms,
    keyRef,
    row.identityEncrypted,
    bookingTravelerIdentitySchema,
  )
  const dietary = await decryptOptionalJsonEnvelope(
    options.kms,
    keyRef,
    row.dietaryEncrypted,
    bookingTravelerDietarySchema,
  )
  const accessibility = await decryptOptionalJsonEnvelope(
    options.kms,
    keyRef,
    row.accessibilityEncrypted,
    bookingTravelerAccessibilitySchema,
  )

  return {
    nationality: identity?.nationality ?? null,
    documentType: identity?.documentType ?? null,
    documentNumber: identity?.documentNumber ?? null,
    documentExpiry: identity?.documentExpiry ?? null,
    documentIssuingCountry: identity?.documentIssuingCountry ?? null,
    documentIssuingAuthority: identity?.documentIssuingAuthority ?? null,
    documentPersonDocumentId: row.documentPersonDocumentId ?? null,
    dateOfBirth: identity?.dateOfBirth ?? null,
    dietaryRequirements: dietary?.dietaryRequirements ?? null,
    accessibilityNeeds: accessibility?.accessibilityNeeds ?? null,
    isLeadTraveler: row.isLeadTraveler,
    sharingGroupId: row.sharingGroupId ?? null,
    roomTypeId: row.roomTypeId ?? null,
    bedPreference: row.bedPreference ?? null,
    allocations: row.allocations ?? {},
  }
}

function mergeTravelDetailInput(
  existing: Awaited<ReturnType<typeof loadExistingTravelDetails>>,
  input: UpsertBookingTravelerTravelDetailInput,
): UpsertBookingTravelerTravelDetailInput {
  return {
    nationality:
      input.nationality === undefined ? (existing?.nationality ?? null) : input.nationality,
    documentNumber:
      input.documentNumber === undefined
        ? (existing?.documentNumber ?? null)
        : input.documentNumber,
    documentType:
      input.documentType === undefined ? (existing?.documentType ?? null) : input.documentType,
    documentExpiry:
      input.documentExpiry === undefined
        ? (existing?.documentExpiry ?? null)
        : input.documentExpiry,
    documentIssuingCountry:
      input.documentIssuingCountry === undefined
        ? (existing?.documentIssuingCountry ?? null)
        : input.documentIssuingCountry,
    documentIssuingAuthority:
      input.documentIssuingAuthority === undefined
        ? (existing?.documentIssuingAuthority ?? null)
        : input.documentIssuingAuthority,
    documentPersonDocumentId:
      input.documentPersonDocumentId === undefined
        ? (existing?.documentPersonDocumentId ?? null)
        : input.documentPersonDocumentId,
    dateOfBirth:
      input.dateOfBirth === undefined ? (existing?.dateOfBirth ?? null) : input.dateOfBirth,
    dietaryRequirements:
      input.dietaryRequirements === undefined
        ? (existing?.dietaryRequirements ?? null)
        : input.dietaryRequirements,
    accessibilityNeeds:
      input.accessibilityNeeds === undefined
        ? (existing?.accessibilityNeeds ?? null)
        : input.accessibilityNeeds,
    isLeadTraveler:
      input.isLeadTraveler === undefined
        ? (existing?.isLeadTraveler ?? false)
        : input.isLeadTraveler,
    sharingGroupId:
      input.sharingGroupId === undefined
        ? (existing?.sharingGroupId ?? null)
        : input.sharingGroupId,
    roomTypeId: input.roomTypeId === undefined ? (existing?.roomTypeId ?? null) : input.roomTypeId,
    bedPreference:
      input.bedPreference === undefined ? (existing?.bedPreference ?? null) : input.bedPreference,
    allocations:
      input.allocations === undefined ? (existing?.allocations ?? {}) : input.allocations,
  }
}

export function createBookingPiiService(options: BookingPiiServiceOptions): BookingPiiService {
  const keyRef = options.keyRef ?? { keyType: "people" as const }

  return {
    async getTravelerTravelDetails(
      db: PostgresJsDatabase,
      travelerId: string,
      actorId?: string | null,
    ): Promise<DecryptedBookingTravelerTravelDetail | null> {
      const [row] = await db
        .select()
        .from(bookingTravelerTravelDetails)
        .where(eq(bookingTravelerTravelDetails.travelerId, travelerId))
        .limit(1)

      if (!row) {
        return null
      }

      const identity = await decryptOptionalJsonEnvelope(
        options.kms,
        keyRef,
        row.identityEncrypted,
        bookingTravelerIdentitySchema,
      )
      const dietary = await decryptOptionalJsonEnvelope(
        options.kms,
        keyRef,
        row.dietaryEncrypted,
        bookingTravelerDietarySchema,
      )
      const accessibility = await decryptOptionalJsonEnvelope(
        options.kms,
        keyRef,
        row.accessibilityEncrypted,
        bookingTravelerAccessibilitySchema,
      )

      await options.onAudit?.({ action: "decrypt", travelerId, actorId })

      return {
        travelerId: row.travelerId,
        nationality: identity?.nationality ?? null,
        documentType: identity?.documentType ?? null,
        documentNumber: identity?.documentNumber ?? null,
        documentExpiry: identity?.documentExpiry ?? null,
        documentIssuingCountry: identity?.documentIssuingCountry ?? null,
        documentIssuingAuthority: identity?.documentIssuingAuthority ?? null,
        documentPersonDocumentId: row.documentPersonDocumentId ?? null,
        dateOfBirth: identity?.dateOfBirth ?? null,
        dietaryRequirements: dietary?.dietaryRequirements ?? null,
        accessibilityNeeds: accessibility?.accessibilityNeeds ?? null,
        isLeadTraveler: row.isLeadTraveler,
        sharingGroupId: row.sharingGroupId ?? null,
        roomTypeId: row.roomTypeId ?? null,
        bedPreference: row.bedPreference ?? null,
        allocations: row.allocations ?? {},
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
    },

    async upsertTravelerTravelDetails(
      db: PostgresJsDatabase,
      travelerId: string,
      input: UpsertBookingTravelerTravelDetailInput,
      actorId?: string | null,
    ): Promise<DecryptedBookingTravelerTravelDetail | null> {
      const [traveler] = await db
        .select({ id: bookingTravelers.id })
        .from(bookingTravelers)
        .where(eq(bookingTravelers.id, travelerId))
        .limit(1)

      if (!traveler) {
        return null
      }

      const existing = await loadExistingTravelDetails(db, travelerId, options, keyRef)
      const mergedInput = mergeTravelDetailInput(existing, input)

      const identityEncrypted = await encryptOptionalJsonEnvelope(
        options.kms,
        keyRef,
        buildIdentityPayload(mergedInput),
      )
      const dietaryEncrypted = await encryptOptionalJsonEnvelope(
        options.kms,
        keyRef,
        buildDietaryPayload(mergedInput),
      )
      const accessibilityEncrypted = await encryptOptionalJsonEnvelope(
        options.kms,
        keyRef,
        buildAccessibilityPayload(mergedInput),
      )
      const now = new Date()

      await db
        .insert(bookingTravelerTravelDetails)
        .values({
          travelerId,
          identityEncrypted,
          dietaryEncrypted,
          accessibilityEncrypted,
          documentPersonDocumentId: mergedInput.documentPersonDocumentId ?? null,
          isLeadTraveler: mergedInput.isLeadTraveler ?? false,
          sharingGroupId: mergedInput.sharingGroupId ?? null,
          roomTypeId: mergedInput.roomTypeId ?? null,
          bedPreference: mergedInput.bedPreference ?? null,
          allocations: mergedInput.allocations ?? {},
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: bookingTravelerTravelDetails.travelerId,
          set: {
            identityEncrypted,
            dietaryEncrypted,
            accessibilityEncrypted,
            documentPersonDocumentId: mergedInput.documentPersonDocumentId ?? null,
            isLeadTraveler: mergedInput.isLeadTraveler ?? false,
            sharingGroupId: mergedInput.sharingGroupId ?? null,
            roomTypeId: mergedInput.roomTypeId ?? null,
            bedPreference: mergedInput.bedPreference ?? null,
            allocations: mergedInput.allocations ?? {},
            updatedAt: now,
          },
        })

      await options.onAudit?.({ action: "encrypt", travelerId, actorId })

      return this.getTravelerTravelDetails(db, travelerId, actorId)
    },

    async deleteTravelerTravelDetails(
      db: PostgresJsDatabase,
      travelerId: string,
      actorId?: string | null,
    ) {
      const [row] = await db
        .delete(bookingTravelerTravelDetails)
        .where(eq(bookingTravelerTravelDetails.travelerId, travelerId))
        .returning({ travelerId: bookingTravelerTravelDetails.travelerId })

      if (row) {
        await options.onAudit?.({ action: "delete", travelerId, actorId })
      }

      return row ?? null
    },
  }
}

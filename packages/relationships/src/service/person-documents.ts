import { RequestValidationError } from "@voyant-travel/hono"
import type { KeyRef, KmsProvider } from "@voyant-travel/utils"
import { decryptOptionalJsonEnvelope } from "@voyant-travel/utils"
import { and, asc, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { z } from "zod"

import { people, personDocuments } from "../schema.js"
import type {
  insertPersonDocumentSchema,
  personDocumentListQuerySchema,
  updatePersonDocumentSchema,
} from "../validation.js"

/**
 * Canonical plaintext shape for free-text PII blobs encrypted as
 * `accessibilityEncrypted` / `dietaryEncrypted` / `loyaltyEncrypted` /
 * `insuranceEncrypted` on `relationships.people`. Wrapped so future fields can
 * be added without breaking existing ciphertexts.
 *
 * Writers (customer-portal) and readers (crm + bookings snapshot)
 * must use this shape — drift between sides means decryption fails
 * silently and pre-fill stops working.
 */
export const personPiiBlobPlaintextSchema = z.object({ text: z.string() })

/**
 * Canonical plaintext shape for `numberEncrypted` on
 * `relationships.person_documents`. Same compatibility contract as
 * `personPiiBlobPlaintextSchema`.
 */
export const personDocumentNumberPlaintextSchema = z.object({ number: z.string() })

/** Plaintext, mergeable snapshot derived from a person record. */
export interface PersonTravelSnapshot {
  dateOfBirth: string | null
  dietaryRequirements: string | null
  accessibilityNeeds: string | null
  documentType: PersonDocumentType | null
  documentNumber: string | null
  documentExpiry: string | null
  documentIssuingCountry: string | null
  documentIssuingAuthority: string | null
  documentPersonDocumentId: string | null
}

export type CreatePersonDocumentInput = z.infer<typeof insertPersonDocumentSchema>
export type UpdatePersonDocumentInput = z.infer<typeof updatePersonDocumentSchema>
export type PersonDocumentListQuery = z.infer<typeof personDocumentListQuerySchema>
export type PersonDocumentType = CreatePersonDocumentInput["type"]

async function personExists(db: PostgresJsDatabase, personId: string) {
  const [row] = await db
    .select({ id: people.id })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1)
  return Boolean(row)
}

function assertValidDocumentDateRange(issueDate?: string | null, expiryDate?: string | null) {
  if (issueDate && expiryDate && expiryDate < issueDate) {
    throw new RequestValidationError("expiryDate must be on or after issueDate", {
      fields: { expiryDate: ["expiryDate must be on or after issueDate"] },
    })
  }
}

async function clearPrimaryForType(
  db: PostgresJsDatabase,
  personId: string,
  type: PersonDocumentType,
  exceptDocumentId?: string,
) {
  const conditions = [
    eq(personDocuments.personId, personId),
    eq(personDocuments.type, type),
    eq(personDocuments.isPrimary, true),
  ]
  if (exceptDocumentId) {
    // agent-quality: raw-sql reviewed -- owner: crm; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    conditions.push(sql`${personDocuments.id} <> ${exceptDocumentId}`)
  }
  await db
    .update(personDocuments)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(and(...conditions))
}

export const personDocumentsService = {
  listPersonDocuments(db: PostgresJsDatabase, personId: string, query?: PersonDocumentListQuery) {
    const conditions = [eq(personDocuments.personId, personId)]
    if (query?.type) conditions.push(eq(personDocuments.type, query.type))
    if (query?.expiringBefore) {
      conditions.push(isNotNull(personDocuments.expiryDate))
      conditions.push(lte(personDocuments.expiryDate, query.expiringBefore))
    }
    const limit = query?.limit ?? 50
    const offset = query?.offset ?? 0
    return db
      .select()
      .from(personDocuments)
      .where(and(...conditions))
      .orderBy(asc(personDocuments.type), asc(personDocuments.createdAt))
      .limit(limit)
      .offset(offset)
  },

  async getPersonDocument(db: PostgresJsDatabase, documentId: string) {
    const [row] = await db
      .select()
      .from(personDocuments)
      .where(eq(personDocuments.id, documentId))
      .limit(1)
    return row ?? null
  },

  /**
   * Decrypts the `numberEncrypted` slot for a single document and
   * returns the plaintext. Returns `null` when the document has no
   * encrypted number on file. Caller is responsible for authorization
   * and audit-logging; this is just the KMS unwrap.
   */
  async revealPersonDocumentNumber(
    db: PostgresJsDatabase,
    documentId: string,
    options: { kms: KmsProvider; keyRef?: KeyRef },
  ): Promise<{ documentId: string; number: string | null } | null> {
    const row = await personDocumentsService.getPersonDocument(db, documentId)
    if (!row) return null
    if (!row.numberEncrypted) return { documentId, number: null }
    const keyRef = options.keyRef ?? { keyType: "people" as const }
    const decrypted = await decryptOptionalJsonEnvelope(
      options.kms,
      keyRef,
      row.numberEncrypted,
      personDocumentNumberPlaintextSchema,
    )
    return { documentId, number: decrypted?.number ?? null }
  },

  /**
   * Returns the primary document of a given type for a person, or
   * `null` if no primary is set.
   */
  async getPrimaryPersonDocument(
    db: PostgresJsDatabase,
    personId: string,
    type: PersonDocumentType,
  ) {
    const [row] = await db
      .select()
      .from(personDocuments)
      .where(
        and(
          eq(personDocuments.personId, personId),
          eq(personDocuments.type, type),
          eq(personDocuments.isPrimary, true),
        ),
      )
      .limit(1)
    return row ?? null
  },

  async createPersonDocument(
    db: PostgresJsDatabase,
    personId: string,
    data: CreatePersonDocumentInput,
  ) {
    if (!(await personExists(db, personId))) return null
    assertValidDocumentDateRange(data.issueDate, data.expiryDate)

    return db.transaction(async (tx) => {
      if (data.isPrimary) {
        await clearPrimaryForType(tx as PostgresJsDatabase, personId, data.type)
      }
      const [row] = await tx
        .insert(personDocuments)
        .values({ ...data, personId })
        .returning()
      return row ?? null
    })
  },

  async updatePersonDocument(
    db: PostgresJsDatabase,
    documentId: string,
    data: UpdatePersonDocumentInput,
  ) {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(personDocuments)
        .where(eq(personDocuments.id, documentId))
        .limit(1)
      if (!existing) return null

      assertValidDocumentDateRange(
        data.issueDate !== undefined ? data.issueDate : existing.issueDate,
        data.expiryDate !== undefined ? data.expiryDate : existing.expiryDate,
      )

      // Clear prior primary of the *target* type whenever the row
      // will end up primary after this update — including the case
      // where `isPrimary` is unchanged but `type` is being switched
      // and the existing row is already primary. Without this, the
      // partial unique index `(person_id, type) WHERE is_primary`
      // rejects type-only edits on a primary doc.
      const effectiveIsPrimary = data.isPrimary ?? existing.isPrimary
      if (effectiveIsPrimary) {
        const targetType = data.type ?? existing.type
        await clearPrimaryForType(
          tx as PostgresJsDatabase,
          existing.personId,
          targetType,
          documentId,
        )
      }

      const [row] = await tx
        .update(personDocuments)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(personDocuments.id, documentId))
        .returning()
      return row ?? null
    })
  },

  async deletePersonDocument(db: PostgresJsDatabase, documentId: string) {
    const [row] = await db
      .delete(personDocuments)
      .where(eq(personDocuments.id, documentId))
      .returning({ id: personDocuments.id })
    return row ?? null
  },

  /**
   * Atomically promotes a document to primary, demoting any prior
   * primary of the same type for the same person.
   */
  async setPrimaryPersonDocument(db: PostgresJsDatabase, documentId: string) {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(personDocuments)
        .where(eq(personDocuments.id, documentId))
        .limit(1)
      if (!existing) return null

      await clearPrimaryForType(
        tx as PostgresJsDatabase,
        existing.personId,
        existing.type,
        documentId,
      )

      const [row] = await tx
        .update(personDocuments)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(personDocuments.id, documentId))
        .returning()
      return row ?? null
    })
  },

  /**
   * Plaintext snapshot of the fields a booking-traveler creation
   * pulls from a person record: dietary, accessibility, primary identity
   * document (type + number + expiry + country + authority + provenance id),
   * and date-of-birth from `people.dateOfBirth`.
   *
   * Caller passes a KMS provider so decryption happens in-process.
   * Missing person → returns null. Missing document or blob → that
   * field returns null in the snapshot.
   */
  async loadPersonTravelSnapshot(
    db: PostgresJsDatabase,
    personId: string,
    options: { kms: KmsProvider; keyRef?: KeyRef },
  ): Promise<PersonTravelSnapshot | null> {
    const [personRow] = await db
      .select({
        dateOfBirth: people.dateOfBirth,
        accessibilityEncrypted: people.accessibilityEncrypted,
        dietaryEncrypted: people.dietaryEncrypted,
      })
      .from(people)
      .where(eq(people.id, personId))
      .limit(1)
    if (!personRow) return null

    const keyRef = options.keyRef ?? { keyType: "people" as const }

    const primaryDocumentPromise = db
      .select()
      .from(personDocuments)
      .where(and(eq(personDocuments.personId, personId), eq(personDocuments.isPrimary, true)))
      .orderBy(desc(personDocuments.updatedAt))
      .limit(1)

    const [accessibilityBlob, dietaryBlob, primaryDocuments] = await Promise.all([
      decryptOptionalJsonEnvelope(
        options.kms,
        keyRef,
        personRow.accessibilityEncrypted,
        personPiiBlobPlaintextSchema,
      ),
      decryptOptionalJsonEnvelope(
        options.kms,
        keyRef,
        personRow.dietaryEncrypted,
        personPiiBlobPlaintextSchema,
      ),
      primaryDocumentPromise,
    ])
    const primaryDocument = primaryDocuments[0] ?? null

    let documentNumber: string | null = null
    if (primaryDocument?.numberEncrypted) {
      const decrypted = await decryptOptionalJsonEnvelope(
        options.kms,
        keyRef,
        primaryDocument.numberEncrypted,
        personDocumentNumberPlaintextSchema,
      )
      documentNumber = decrypted?.number ?? null
    }

    return {
      dateOfBirth: personRow.dateOfBirth ?? null,
      dietaryRequirements: dietaryBlob?.text ?? null,
      accessibilityNeeds: accessibilityBlob?.text ?? null,
      documentType: primaryDocument?.type ?? null,
      documentNumber,
      documentExpiry: primaryDocument?.expiryDate ?? null,
      documentIssuingCountry: primaryDocument?.issuingCountry ?? null,
      documentIssuingAuthority: primaryDocument?.issuingAuthority ?? null,
      documentPersonDocumentId: primaryDocument?.id ?? null,
    }
  },

  /**
   * Documents whose `expiryDate` falls within the next `daysAhead`
   * days. Used by the future `crm.detect-expiring-documents` cron;
   * shipped now since the helper is free.
   */
  listExpiringPersonDocuments(db: PostgresJsDatabase, daysAhead = 90) {
    const today = new Date()
    const horizon = new Date(today)
    horizon.setUTCDate(horizon.getUTCDate() + daysAhead)
    const todayIso = today.toISOString().slice(0, 10)
    const horizonIso = horizon.toISOString().slice(0, 10)

    return db
      .select()
      .from(personDocuments)
      .where(
        and(
          isNotNull(personDocuments.expiryDate),
          gte(personDocuments.expiryDate, todayIso),
          lte(personDocuments.expiryDate, horizonIso),
        ),
      )
      .orderBy(asc(personDocuments.expiryDate))
  },
}

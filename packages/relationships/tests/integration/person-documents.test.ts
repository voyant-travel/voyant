import {
  EnvKmsProvider,
  encryptOptionalJsonEnvelope,
  generateEnvKmsKey,
} from "@voyant-travel/utils"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { people, personDocuments } from "../../src/schema.js"
import {
  personDocumentNumberPlaintextSchema,
  personDocumentsService,
  personPiiBlobPlaintextSchema,
} from "../../src/service/person-documents.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("personDocumentsService", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test db typing -- owner: crm; existing suppression is intentional pending typed cleanup.
  let db: any

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  async function seedPerson(overrides: { dateOfBirth?: string } = {}) {
    const [row] = await db
      .insert(people)
      .values({
        firstName: "Ana",
        lastName: "Test",
        tags: [],
        status: "active",
        ...overrides,
      })
      .returning()
    return row
  }

  it("creates and lists documents scoped to a person", async () => {
    const person = await seedPerson()
    const a = await personDocumentsService.createPersonDocument(db, person.id, {
      type: "passport",
      isPrimary: true,
    })
    const b = await personDocumentsService.createPersonDocument(db, person.id, {
      type: "id_card",
      isPrimary: true,
    })
    expect(a?.id).toBeTruthy()
    expect(b?.id).toBeTruthy()

    const list = await personDocumentsService.listPersonDocuments(db, person.id)
    expect(list).toHaveLength(2)
    const types = list.map((doc) => doc.type).sort()
    expect(types).toEqual(["id_card", "passport"])
  })

  it("returns null when creating a document for a missing person", async () => {
    const result = await personDocumentsService.createPersonDocument(db, "pers_missing", {
      type: "passport",
      isPrimary: false,
    })
    expect(result).toBeNull()
  })

  it("enforces a single primary document per type per person", async () => {
    const person = await seedPerson()
    const first = await personDocumentsService.createPersonDocument(db, person.id, {
      type: "passport",
      isPrimary: true,
    })
    const second = await personDocumentsService.createPersonDocument(db, person.id, {
      type: "passport",
      isPrimary: true,
    })
    expect(first?.id).toBeTruthy()
    expect(second?.id).toBeTruthy()

    const all = await personDocumentsService.listPersonDocuments(db, person.id)
    const primaryIds = all.filter((doc) => doc.isPrimary).map((doc) => doc.id)
    expect(primaryIds).toEqual([second?.id])
  })

  it("changing the type of a primary doc demotes the existing primary of the new type", async () => {
    const person = await seedPerson()
    // Existing primary id_card.
    const idCard = await personDocumentsService.createPersonDocument(db, person.id, {
      type: "id_card",
      isPrimary: true,
    })
    // Existing primary document that we'll re-type to id_card without
    // touching `isPrimary`. Without the fix this hits the partial
    // unique index and fails with a DB error.
    const passport = await personDocumentsService.createPersonDocument(db, person.id, {
      type: "passport",
      isPrimary: true,
    })
    if (!idCard || !passport) throw new Error("seed failure")

    const updated = await personDocumentsService.updatePersonDocument(db, passport.id, {
      type: "id_card",
    })
    expect(updated?.type).toBe("id_card")
    expect(updated?.isPrimary).toBe(true)

    const all = await personDocumentsService.listPersonDocuments(db, person.id)
    const primaryIdCards = all.filter((doc) => doc.type === "id_card" && doc.isPrimary)
    expect(primaryIdCards.map((doc) => doc.id)).toEqual([passport.id])

    const refreshedOldIdCard = await personDocumentsService.getPersonDocument(db, idCard.id)
    expect(refreshedOldIdCard?.isPrimary).toBe(false)
  })

  it("setPrimaryPersonDocument promotes one and demotes prior primary", async () => {
    const person = await seedPerson()
    const first = await personDocumentsService.createPersonDocument(db, person.id, {
      type: "passport",
      isPrimary: true,
    })
    const second = await personDocumentsService.createPersonDocument(db, person.id, {
      type: "passport",
      isPrimary: false,
    })
    if (!first || !second) throw new Error("seed failure")

    const promoted = await personDocumentsService.setPrimaryPersonDocument(db, second.id)
    expect(promoted?.isPrimary).toBe(true)

    const refreshed = await personDocumentsService.getPersonDocument(db, first.id)
    expect(refreshed?.isPrimary).toBe(false)
  })

  it("rejects reversed document date ranges on create and merged update", async () => {
    const person = await seedPerson()

    await expect(
      personDocumentsService.createPersonDocument(db, person.id, {
        type: "visa",
        issueDate: "2031-01-01",
        expiryDate: "2026-01-01",
      }),
    ).rejects.toThrow("expiryDate must be on or after issueDate")

    const created = await personDocumentsService.createPersonDocument(db, person.id, {
      type: "passport",
      issueDate: "2026-01-01",
      expiryDate: "2031-01-01",
    })
    if (!created) throw new Error("expected document")

    await expect(
      personDocumentsService.updatePersonDocument(db, created.id, {
        issueDate: "2032-01-01",
      }),
    ).rejects.toThrow("expiryDate must be on or after issueDate")
  })

  it("getPrimaryPersonDocument returns the matching primary or null", async () => {
    const person = await seedPerson()
    expect(
      await personDocumentsService.getPrimaryPersonDocument(db, person.id, "passport"),
    ).toBeNull()

    await personDocumentsService.createPersonDocument(db, person.id, {
      type: "passport",
      isPrimary: true,
      issuingCountry: "RO",
    })
    const primary = await personDocumentsService.getPrimaryPersonDocument(db, person.id, "passport")
    expect(primary?.issuingCountry).toBe("RO")
    expect(primary?.isPrimary).toBe(true)

    expect(
      await personDocumentsService.getPrimaryPersonDocument(db, person.id, "id_card"),
    ).toBeNull()
  })

  it("listExpiringPersonDocuments returns docs within the horizon", async () => {
    const person = await seedPerson()
    const today = new Date()
    const inThirty = new Date(today)
    inThirty.setUTCDate(inThirty.getUTCDate() + 30)
    const inSixHundred = new Date(today)
    inSixHundred.setUTCDate(inSixHundred.getUTCDate() + 600)
    const yesterday = new Date(today)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)

    const iso = (d: Date) => d.toISOString().slice(0, 10)

    await personDocumentsService.createPersonDocument(db, person.id, {
      type: "passport",
      isPrimary: true,
      expiryDate: iso(inThirty),
    })
    await personDocumentsService.createPersonDocument(db, person.id, {
      type: "id_card",
      isPrimary: true,
      expiryDate: iso(inSixHundred),
    })
    await personDocumentsService.createPersonDocument(db, person.id, {
      type: "visa",
      isPrimary: true,
      expiryDate: iso(yesterday),
    })

    const upcoming = await personDocumentsService.listExpiringPersonDocuments(db, 90)
    const types = upcoming.map((doc) => doc.type)
    expect(types).toContain("passport")
    expect(types).not.toContain("id_card")
    expect(types).not.toContain("visa")
  })

  it("loadPersonTravelSnapshot decrypts blobs + primary document", async () => {
    const kms = new EnvKmsProvider({ key: generateEnvKmsKey() })
    const person = await seedPerson({ dateOfBirth: "1990-04-15" })

    const dietaryEncrypted = await encryptOptionalJsonEnvelope(
      kms,
      { keyType: "people" },
      personPiiBlobPlaintextSchema.parse({ text: "Vegan" }),
    )
    const accessibilityEncrypted = await encryptOptionalJsonEnvelope(
      kms,
      { keyType: "people" },
      personPiiBlobPlaintextSchema.parse({ text: "Step-free access" }),
    )
    await db
      .update(people)
      .set({ dietaryEncrypted, accessibilityEncrypted })
      .where(eq(people.id, person.id))

    const numberEncrypted = await encryptOptionalJsonEnvelope(
      kms,
      { keyType: "people" },
      personDocumentNumberPlaintextSchema.parse({ number: "AA123456" }),
    )
    const created = await personDocumentsService.createPersonDocument(db, person.id, {
      type: "passport",
      isPrimary: true,
      issuingCountry: "RO",
      issuingAuthority: "IGI",
      expiryDate: "2030-01-01",
      numberEncrypted,
    })
    if (!created) throw new Error("expected primary document")

    const snapshot = await personDocumentsService.loadPersonTravelSnapshot(db, person.id, { kms })
    expect(snapshot).toEqual({
      dateOfBirth: "1990-04-15",
      dietaryRequirements: "Vegan",
      accessibilityNeeds: "Step-free access",
      documentType: "passport",
      documentNumber: "AA123456",
      documentExpiry: "2030-01-01",
      documentIssuingCountry: "RO",
      documentIssuingAuthority: "IGI",
      documentPersonDocumentId: created.id,
    })

    // Sanity: no plaintext leaks into storage.
    const [stored] = await db
      .select()
      .from(personDocuments)
      .where(eq(personDocuments.id, created.id))
    expect(stored?.numberEncrypted?.enc).toMatch(/^env:v1:/)
    expect(stored?.numberEncrypted?.enc).not.toContain("AA123456")
  })

  it("loadPersonTravelSnapshot can snapshot a non-passport primary document", async () => {
    const kms = new EnvKmsProvider({ key: generateEnvKmsKey() })
    const person = await seedPerson()
    const numberEncrypted = await encryptOptionalJsonEnvelope(
      kms,
      { keyType: "people" },
      personDocumentNumberPlaintextSchema.parse({ number: "ID-123" }),
    )
    const created = await personDocumentsService.createPersonDocument(db, person.id, {
      type: "id_card",
      isPrimary: true,
      issuingCountry: "RO",
      issuingAuthority: "DEPABD",
      expiryDate: "2031-05-01",
      numberEncrypted,
    })
    if (!created) throw new Error("expected primary id card")

    const snapshot = await personDocumentsService.loadPersonTravelSnapshot(db, person.id, { kms })

    expect(snapshot).toMatchObject({
      documentType: "id_card",
      documentNumber: "ID-123",
      documentExpiry: "2031-05-01",
      documentIssuingCountry: "RO",
      documentIssuingAuthority: "DEPABD",
      documentPersonDocumentId: created.id,
    })
  })

  it("loadPersonTravelSnapshot returns null for unknown person", async () => {
    const kms = new EnvKmsProvider({ key: generateEnvKmsKey() })
    const result = await personDocumentsService.loadPersonTravelSnapshot(db, "pers_missing", {
      kms,
    })
    expect(result).toBeNull()
  })

  it("loadPersonTravelSnapshot returns nulls when no primary document / blobs are set", async () => {
    const kms = new EnvKmsProvider({ key: generateEnvKmsKey() })
    const person = await seedPerson({ dateOfBirth: "1985-12-01" })
    const snapshot = await personDocumentsService.loadPersonTravelSnapshot(db, person.id, { kms })
    expect(snapshot).toEqual({
      dateOfBirth: "1985-12-01",
      dietaryRequirements: null,
      accessibilityNeeds: null,
      documentType: null,
      documentNumber: null,
      documentExpiry: null,
      documentIssuingCountry: null,
      documentIssuingAuthority: null,
      documentPersonDocumentId: null,
    })
  })
})

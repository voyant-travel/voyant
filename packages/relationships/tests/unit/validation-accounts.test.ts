import { describe, expect, it } from "vitest"

import {
  insertOrganizationSchema,
  insertPersonSchema,
  relationTypeSchema,
  updateOrganizationSchema,
  updatePersonSchema,
} from "../../src/validation.js"

describe("Organization schemas", () => {
  it("accepts valid input with defaults", () => {
    const result = insertOrganizationSchema.parse({ name: "Acme Corp" })
    expect(result.name).toBe("Acme Corp")
    expect(result.status).toBe("active")
    expect(result.tags).toEqual([])
  })

  it("rejects empty name", () => {
    expect(() => insertOrganizationSchema.parse({ name: "" })).toThrow()
  })

  it("transforms empty website to null", () => {
    const result = insertOrganizationSchema.parse({ name: "Acme", website: "" })
    expect(result.website).toBeNull()
  })

  it("accepts valid website URL", () => {
    const result = insertOrganizationSchema.parse({
      name: "Acme",
      website: "https://acme.com",
    })
    expect(result.website).toBe("https://acme.com")
  })

  it("accepts taxId", () => {
    const result = insertOrganizationSchema.parse({ name: "Acme", taxId: " RO44255073 " })
    expect(result.taxId).toBe("RO44255073")
  })

  it("normalizes empty taxId to null", () => {
    const result = insertOrganizationSchema.parse({ name: "Acme", taxId: "" })
    expect(result.taxId).toBeNull()
  })

  it("rejects invalid website URL", () => {
    expect(() => insertOrganizationSchema.parse({ name: "Acme", website: "not-a-url" })).toThrow()
  })

  it("allows partial updates with only provided fields", () => {
    const result = updateOrganizationSchema.parse({ name: "New Name" })
    expect(result.name).toBe("New Name")
    expect(result.status).toBeUndefined()
    expect(result.tags).toBeUndefined()
    expect(result.legalName).toBeUndefined()
  })

  it("does not apply create defaults to empty updates", () => {
    expect(updateOrganizationSchema.parse({})).toEqual({})
  })

  it("accepts relation enum", () => {
    const result = insertOrganizationSchema.parse({ name: "Acme", relation: "client" })
    expect(result.relation).toBe("client")
  })

  it("rejects invalid relation", () => {
    expect(() => insertOrganizationSchema.parse({ name: "Acme", relation: "invalid" })).toThrow()
  })

  it("accepts paymentTerms as positive integer", () => {
    const result = insertOrganizationSchema.parse({ name: "Acme", paymentTerms: 30 })
    expect(result.paymentTerms).toBe(30)
  })

  it("rejects excessive paymentTerms", () => {
    expect(() => insertOrganizationSchema.parse({ name: "Acme", paymentTerms: 999 })).toThrow()
  })

  it("rejects negative paymentTerms", () => {
    expect(() => insertOrganizationSchema.parse({ name: "Acme", paymentTerms: -1 })).toThrow()
  })

  it("rejects zero paymentTerms", () => {
    expect(() => insertOrganizationSchema.parse({ name: "Acme", paymentTerms: 0 })).toThrow()
  })

  it("accepts ISO currency code", () => {
    const result = insertOrganizationSchema.parse({ name: "Acme", defaultCurrency: "EUR" })
    expect(result.defaultCurrency).toBe("EUR")
  })

  it("rejects invalid defaultCurrency", () => {
    expect(() => insertOrganizationSchema.parse({ name: "Acme", defaultCurrency: "X" })).toThrow()
    expect(() => insertOrganizationSchema.parse({ name: "Acme", defaultCurrency: "usd" })).toThrow()
  })

  it("accepts preferredLanguage", () => {
    const result = insertOrganizationSchema.parse({ name: "Acme", preferredLanguage: "en" })
    expect(result.preferredLanguage).toBe("en")
  })
})

describe("Person schemas", () => {
  it("requires firstName and lastName", () => {
    const result = insertPersonSchema.parse({ firstName: "John", lastName: "Doe" })
    expect(result.firstName).toBe("John")
    expect(result.lastName).toBe("Doe")
    expect(result.status).toBe("active")
    expect(result.tags).toEqual([])
  })

  it("rejects missing firstName", () => {
    expect(() => insertPersonSchema.parse({ lastName: "Doe" })).toThrow()
  })

  it("rejects missing lastName", () => {
    expect(() => insertPersonSchema.parse({ firstName: "John" })).toThrow()
  })

  it("accepts valid dateOfBirth", () => {
    const result = insertPersonSchema.parse({
      firstName: "John",
      lastName: "Doe",
      dateOfBirth: "1990-01-15",
    })
    expect(result.dateOfBirth).toBe("1990-01-15")
  })

  it("rejects invalid dateOfBirth format", () => {
    expect(() =>
      insertPersonSchema.parse({
        firstName: "John",
        lastName: "Doe",
        dateOfBirth: "not-a-date",
      }),
    ).toThrow()
  })

  it("accepts relation enum", () => {
    const result = insertPersonSchema.parse({
      firstName: "John",
      lastName: "Doe",
      relation: "supplier",
    })
    expect(result.relation).toBe("supplier")
  })

  it("accepts preferredLanguage and preferredCurrency", () => {
    const result = insertPersonSchema.parse({
      firstName: "John",
      lastName: "Doe",
      preferredLanguage: "fr",
      preferredCurrency: "EUR",
    })
    expect(result.preferredLanguage).toBe("fr")
    expect(result.preferredCurrency).toBe("EUR")
  })

  describe("inline identity fields", () => {
    it("accepts valid email", () => {
      const result = insertPersonSchema.parse({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      })
      expect(result.email).toBe("john@example.com")
    })

    it("rejects invalid email", () => {
      expect(() =>
        insertPersonSchema.parse({
          firstName: "John",
          lastName: "Doe",
          email: "not-an-email",
        }),
      ).toThrow()
    })

    it("accepts null email", () => {
      const result = insertPersonSchema.parse({
        firstName: "John",
        lastName: "Doe",
        email: null,
      })
      expect(result.email).toBeNull()
    })

    it("transforms empty email to null", () => {
      const result = insertPersonSchema.parse({
        firstName: "John",
        lastName: "Doe",
        email: "",
      })
      expect(result.email).toBeNull()
    })

    it("accepts phone number", () => {
      const result = insertPersonSchema.parse({
        firstName: "John",
        lastName: "Doe",
        phone: "+1-555-123-4567",
      })
      expect(result.phone).toBe("+1-555-123-4567")
    })

    it("accepts valid website URL", () => {
      const result = insertPersonSchema.parse({
        firstName: "John",
        lastName: "Doe",
        website: "https://johndoe.com",
      })
      expect(result.website).toBe("https://johndoe.com")
    })

    it("transforms empty website to null", () => {
      const result = insertPersonSchema.parse({
        firstName: "John",
        lastName: "Doe",
        website: "",
      })
      expect(result.website).toBeNull()
    })

    it("rejects invalid website URL", () => {
      expect(() =>
        insertPersonSchema.parse({
          firstName: "John",
          lastName: "Doe",
          website: "not-a-url",
        }),
      ).toThrow()
    })

    it("identity fields are absent or null when omitted", () => {
      const result = insertPersonSchema.parse({ firstName: "John", lastName: "Doe" })
      expect(result.email).toBeUndefined()
      expect(result.phone).toBeUndefined()
      expect(result.website).toBeNull()
    })
  })

  describe("partial update", () => {
    it("allows updating only firstName", () => {
      const result = updatePersonSchema.parse({ firstName: "Jane" })
      expect(result.firstName).toBe("Jane")
      expect(result.lastName).toBeUndefined()
      expect(result.status).toBeUndefined()
      expect(result.tags).toBeUndefined()
    })

    it("does not apply create defaults to empty updates", () => {
      expect(updatePersonSchema.parse({})).toEqual({})
    })

    it("allows updating identity fields independently", () => {
      const result = updatePersonSchema.parse({ email: "new@example.com" })
      expect(result.email).toBe("new@example.com")
    })
  })
})

describe("Relation enum schema", () => {
  it("accepts valid values", () => {
    for (const value of ["client", "partner", "supplier", "other"]) {
      expect(relationTypeSchema.parse(value)).toBe(value)
    }
  })

  it("rejects invalid value", () => {
    expect(() => relationTypeSchema.parse("vendor")).toThrow()
  })
})

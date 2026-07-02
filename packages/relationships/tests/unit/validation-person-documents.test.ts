import { describe, expect, it } from "vitest"

import {
  insertPersonDocumentFromPlaintextSchema,
  insertPersonDocumentSchema,
  updatePersonDocumentFromPlaintextSchema,
  updatePersonDocumentSchema,
} from "../../src/validation.js"

describe("Person document schemas", () => {
  it("accepts valid issue and expiry dates", () => {
    const result = insertPersonDocumentSchema.parse({
      type: "passport",
      issueDate: "2026-01-01",
      expiryDate: "2031-01-01",
    })

    expect(result.issueDate).toBe("2026-01-01")
    expect(result.expiryDate).toBe("2031-01-01")
  })

  it("rejects reversed issue and expiry dates", () => {
    expect(() =>
      insertPersonDocumentSchema.parse({
        type: "visa",
        issueDate: "2031-01-01",
        expiryDate: "2026-01-01",
      }),
    ).toThrow()
  })

  it("validates plaintext document date ranges", () => {
    expect(() =>
      insertPersonDocumentFromPlaintextSchema.parse({
        type: "passport",
        number: "AA123456",
        issueDate: "2031-01-01",
        expiryDate: "2026-01-01",
      }),
    ).toThrow()
  })

  it("allows partial updates for merged service validation", () => {
    const result = updatePersonDocumentSchema.parse({ expiryDate: "2030-01-01" })

    expect(result.expiryDate).toBe("2030-01-01")
  })

  it("rejects explicit reversed partial update ranges", () => {
    expect(() =>
      updatePersonDocumentFromPlaintextSchema.parse({
        issueDate: "2031-01-01",
        expiryDate: "2026-01-01",
      }),
    ).toThrow()
  })
})

import { describe, expect, it } from "vitest"

import {
  bookingAggregatesQuerySchema,
  bookingListQuerySchema,
  insertBookingDocumentSchema,
  insertBookingNoteSchema,
} from "../../src/validation.js"

describe("Booking note schema", () => {
  it("requires content", () => {
    const result = insertBookingNoteSchema.parse({ content: "A note" })
    expect(result.content).toBe("A note")
  })

  it("rejects empty content", () => {
    expect(() => insertBookingNoteSchema.parse({ content: "" })).toThrow()
  })

  it("rejects content over 10000 chars", () => {
    expect(() => insertBookingNoteSchema.parse({ content: "x".repeat(10001) })).toThrow()
  })
})

describe("Booking document schema", () => {
  const valid = {
    type: "visa",
    fileName: "visa.pdf",
    fileUrl: "https://example.com/visa.pdf",
  }

  it("accepts valid input", () => {
    const result = insertBookingDocumentSchema.parse({ ...valid, travelerId: "bkpt_123" })
    expect(result.type).toBe("visa")
    expect(result.fileName).toBe("visa.pdf")
    expect(result.fileUrl).toBe("https://example.com/visa.pdf")
    expect(result.travelerId).toBe("bkpt_123")
  })

  it("accepts valid document types", () => {
    for (const type of ["visa", "insurance", "health", "passport_copy", "other"]) {
      expect(insertBookingDocumentSchema.parse({ ...valid, type }).type).toBe(type)
    }
  })

  it("rejects invalid document type", () => {
    expect(() => insertBookingDocumentSchema.parse({ ...valid, type: "license" })).toThrow()
  })

  it("rejects invalid fileUrl", () => {
    expect(() => insertBookingDocumentSchema.parse({ ...valid, fileUrl: "not-a-url" })).toThrow()
  })

  it("rejects empty fileName", () => {
    expect(() => insertBookingDocumentSchema.parse({ ...valid, fileName: "" })).toThrow()
  })
})

describe("Booking list query schema", () => {
  it("applies default limit and offset", () => {
    const result = bookingListQuerySchema.parse({})
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it("coerces string values", () => {
    const result = bookingListQuerySchema.parse({ limit: "25", offset: "10" })
    expect(result.limit).toBe(25)
    expect(result.offset).toBe(10)
  })

  it("rejects limit over 100", () => {
    expect(() => bookingListQuerySchema.parse({ limit: 101 })).toThrow()
  })

  it("rejects negative offset", () => {
    expect(() => bookingListQuerySchema.parse({ offset: -1 })).toThrow()
  })

  it("passes through optional filters", () => {
    const result = bookingListQuerySchema.parse({
      status: "confirmed",
      search: "hotel",
    })
    expect(result.status).toBe("confirmed")
    expect(result.search).toBe("hotel")
  })

  it("accepts productId, optionId, personId, organizationId filters", () => {
    const result = bookingListQuerySchema.parse({
      productId: "prod_abc",
      optionId: "opto_def",
      supplierId: "supp_mno",
      productCategoryId: "pcat_pqr",
      personId: "pers_ghi",
      organizationId: "org_jkl",
    })
    expect(result.productId).toBe("prod_abc")
    expect(result.optionId).toBe("opto_def")
    expect(result.supplierId).toBe("supp_mno")
    expect(result.productCategoryId).toBe("pcat_pqr")
    expect(result.personId).toBe("pers_ghi")
    expect(result.organizationId).toBe("org_jkl")
  })
})

describe("Booking aggregates query schema", () => {
  it("accepts an empty object", () => {
    const result = bookingAggregatesQuerySchema.parse({})
    expect(result.from).toBeUndefined()
    expect(result.to).toBeUndefined()
  })

  it("accepts ISO datetime bounds", () => {
    const result = bookingAggregatesQuerySchema.parse({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-04-01T00:00:00.000Z",
    })
    expect(result.from).toBe("2026-01-01T00:00:00.000Z")
    expect(result.to).toBe("2026-04-01T00:00:00.000Z")
  })

  it("rejects non-datetime strings", () => {
    expect(() => bookingAggregatesQuerySchema.parse({ from: "yesterday" })).toThrow()
    expect(() => bookingAggregatesQuerySchema.parse({ from: "2026-01-01" })).toThrow()
  })
})

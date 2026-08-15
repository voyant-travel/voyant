import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import {
  type BookingDocumentsToolServices,
  bookingDocumentsTools,
  recordBookingDocumentToolInputSchema,
} from "../src/tools-documents.js"

function context(service?: Partial<BookingDocumentsToolServices>): ToolContext & {
  bookingDocuments?: BookingDocumentsToolServices
} {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "default",
    resolverScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
    bookingDocuments: service as BookingDocumentsToolServices | undefined,
  }
}

function registry() {
  const registry = createToolRegistry()
  registry.registerAll(bookingDocumentsTools)
  return registry
}

const recordedInvoice = {
  id: "bdo_1",
  bookingId: "book_1",
  travelerId: null,
  type: "invoice" as const,
  fileName: "VYT-1042.pdf",
  fileUrl: "https://files.example.com/VYT-1042.pdf",
  issuedBy: "Contabilitate SRL",
  issuedSeries: "VYT",
  issuedNumber: "1042",
  issuedAt: "2026-03-04T00:00:00.000Z",
  expiresAt: null,
  notes: null,
  createdAt: "2026-08-15T09:00:00.000Z",
}

const externalInvoiceCommand = {
  bookingId: "book_1",
  type: "invoice" as const,
  fileName: "VYT-1042.pdf",
  fileUrl: "https://files.example.com/VYT-1042.pdf",
  issuedBy: "Contabilitate SRL",
  issuedSeries: "VYT",
  issuedNumber: "1042",
  issuedAt: "2026-03-04",
}

describe("booking document tools", () => {
  it("exposes recording as a staff write and listing as a PII-gated read", () => {
    const manifest = registry().list()
    expect(manifest.map((tool) => tool.name).sort()).toEqual([
      "list_booking_documents",
      "record_booking_document",
    ])
    for (const tool of manifest) {
      expect(tool.owner).toBe("@voyant-travel/bookings")
      expect(tool.capabilityVersion).toBe("v1")
      expect(tool.audience).toEqual({ source: "grant", allowed: ["staff"] })
    }
    expect(manifest.find((tool) => tool.name === "list_booking_documents")).toMatchObject({
      // Traveller passports and visas live in this collection, so reading it
      // needs the explicit booking-PII grant.
      requiredScopes: ["bookings:read", "bookings-pii:read"],
      tier: "sensitive",
    })
    expect(manifest.find((tool) => tool.name === "record_booking_document")).toMatchObject({
      requiredScopes: ["bookings:write"],
      tier: "write",
      riskPolicy: { destructive: false, reversible: true },
    })
  })

  it("says in its own description that it records rather than issues", () => {
    const tool = bookingDocumentsTools.find((entry) => entry.name === "record_booking_document")
    const description = tool?.description ?? ""
    expect(description).toContain("RECORDS, it does not ISSUE")
    expect(description).toContain("allocates no number")
    expect(description).toMatch(/generate_booking_contract_document|issue_invoice_from_booking/)
  })

  it("refuses an issued document that carries no issuer number or date", () => {
    const missingBoth = recordBookingDocumentToolInputSchema.safeParse({
      bookingId: "book_1",
      type: "invoice",
      fileName: "scan.pdf",
      fileUrl: "https://files.example.com/scan.pdf",
    })
    expect(missingBoth.success).toBe(false)
    expect(missingBoth.error?.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["issuedNumber", "issuedAt"]),
    )

    for (const type of ["contract", "invoice", "proforma", "credit_note"]) {
      expect(
        recordBookingDocumentToolInputSchema.safeParse({
          bookingId: "book_1",
          type,
          fileName: "scan.pdf",
          fileUrl: "https://files.example.com/scan.pdf",
        }).success,
      ).toBe(false)
    }
  })

  it("accepts a traveller document with no issuer identity at all", () => {
    expect(
      recordBookingDocumentToolInputSchema.safeParse({
        bookingId: "book_1",
        type: "passport_copy",
        fileName: "passport.pdf",
        fileUrl: "https://files.example.com/passport.pdf",
        travelerId: "btr_1",
        expiresAt: "2030-01-01",
      }).success,
    ).toBe(true)
  })

  it("passes the issuer's own identity through to the service unchanged", async () => {
    const calls: unknown[] = []
    const result = await registry().dispatch<{ replayed: boolean }>(
      "record_booking_document",
      externalInvoiceCommand,
      context({
        async recordBookingDocument(input) {
          calls.push(input)
          return { document: recordedInvoice, replayed: false }
        },
      }),
    )

    expect(calls).toEqual([externalInvoiceCommand])
    expect(result).toMatchObject({
      status: "recorded",
      replayed: false,
      document: { issuedSeries: "VYT", issuedNumber: "1042" },
      nextActions: [{ tool: "list_booking_documents", input: { bookingId: "book_1" } }],
    })
  })

  it("reports a second recording of the same issued document as a replay", async () => {
    const result = await registry().dispatch<{ replayed: boolean }>(
      "record_booking_document",
      externalInvoiceCommand,
      context({
        async recordBookingDocument() {
          return { document: recordedInvoice, replayed: true }
        },
      }),
    )
    expect(result).toMatchObject({ status: "recorded", replayed: true })
  })

  it("reports a missing booking as NOT_FOUND rather than an empty success", async () => {
    await expect(
      registry().dispatch("record_booking_document", externalInvoiceCommand, {
        ...context({
          async recordBookingDocument() {
            return null
          },
        }),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", meta: { bookingId: "book_1" } })

    await expect(
      registry().dispatch(
        "list_booking_documents",
        { bookingId: "book_missing" },
        context({
          async listBookingDocuments() {
            return null
          },
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("lists what the booking holds", async () => {
    const result = await registry().dispatch<{ data: unknown[] }>(
      "list_booking_documents",
      { bookingId: "book_1" },
      context({
        async listBookingDocuments() {
          return { data: [recordedInvoice] }
        },
      }),
    )
    expect(result.data).toHaveLength(1)
  })
})

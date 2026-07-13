import { createLocalStorageProvider } from "@voyant-travel/storage/providers/local"
import { describe, expect, it } from "vitest"

import {
  createStorageBackedInvoiceDocumentGenerator,
  defaultPdfInvoiceDocumentSerializer,
  defaultStorageBackedInvoiceDocumentSerializer,
} from "../../src/service-documents.js"

describe("createStorageBackedInvoiceDocumentGenerator", () => {
  it("uploads rendered invoice output for supported default formats", async () => {
    const storage = createLocalStorageProvider({ baseUrl: "https://files.example/" })
    const generator = createStorageBackedInvoiceDocumentGenerator({ storage })

    const result = await generator({
      db: {} as never,
      invoice: { id: "inv_123" } as never,
      template: null,
      lineItems: [],
      payments: [],
      renderedBody: "<p>Invoice</p>",
      renderedBodyFormat: "html",
      variables: { invoiceNumber: "INV-123" },
      bindings: {},
      targetFormat: "html",
      language: "ro",
    })

    expect(result.format).toBe("html")
    expect(result.storageKey).toBe("invoices/inv_123/rendition.html")
    expect(result.metadata).toMatchObject({
      storageProvider: "memory",
      url: "https://files.example/invoices/inv_123/rendition.html",
    })

    const bytes = await storage.get(result.storageKey ?? "")
    expect(bytes).not.toBeNull()
    expect(new TextDecoder().decode(bytes ?? undefined)).toBe("<p>Invoice</p>")
  })

  it("provides a built-in pdf serializer", async () => {
    const upload = await defaultPdfInvoiceDocumentSerializer({
      db: {} as never,
      invoice: { id: "inv_123" } as never,
      template: null,
      lineItems: [],
      payments: [],
      renderedBody: "<p>Invoice</p>",
      renderedBodyFormat: "html",
      variables: {},
      bindings: {},
      targetFormat: "pdf",
      language: null,
    })

    expect(upload.format).toBe("pdf")
    expect(upload.body).toBeInstanceOf(Uint8Array)
  })

  it("supports pdf in the default storage-backed serializer", async () => {
    const upload = await defaultStorageBackedInvoiceDocumentSerializer({
      db: {} as never,
      invoice: { id: "inv_123" } as never,
      template: null,
      lineItems: [],
      payments: [],
      renderedBody: "<p>Invoice</p>",
      renderedBodyFormat: "html",
      variables: {},
      bindings: {},
      targetFormat: "pdf",
      language: null,
    })

    expect(upload.format).toBe("pdf")
  })
})

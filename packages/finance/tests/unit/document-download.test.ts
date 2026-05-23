import { describe, expect, it, vi } from "vitest"

import { resolveStoredDocumentDownload } from "../../src/document-download.js"

describe("resolveStoredDocumentDownload", () => {
  it("uses resolver URLs for storage-backed documents", async () => {
    const resolver = vi.fn(async () => "https://signed.example.com/invoice.pdf")

    await expect(
      resolveStoredDocumentDownload(
        {
          storageKey: "invoices/inv_123.pdf",
          metadata: { url: "https://cdn.example.com/fallback.pdf" },
        },
        { bindings: {}, resolveDocumentDownloadUrl: resolver },
      ),
    ).resolves.toEqual({
      status: "ready",
      download: {
        url: "https://signed.example.com/invoice.pdf",
        expiresAt: null,
      },
    })
  })

  it("falls back to metadata URL when the storage resolver is missing", async () => {
    await expect(
      resolveStoredDocumentDownload(
        {
          storageKey: "invoices/inv_123.pdf",
          metadata: {
            url: "https://cdn.example.com/invoice.pdf",
            expiresAt: "2026-05-23T14:00:00.000Z",
          },
        },
        { bindings: {} },
      ),
    ).resolves.toEqual({
      status: "ready",
      download: {
        url: "https://cdn.example.com/invoice.pdf",
        expiresAt: "2026-05-23T14:00:00.000Z",
      },
    })
  })

  it("reports missing resolver when a storage key has no metadata URL fallback", async () => {
    await expect(
      resolveStoredDocumentDownload({ storageKey: "invoices/inv_123.pdf" }, { bindings: {} }),
    ).resolves.toEqual({ status: "resolver_not_configured" })
  })
})

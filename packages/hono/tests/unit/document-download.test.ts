import { describe, expect, it, vi } from "vitest"

import { resolveStoredDocumentDownload } from "../../src/document-download.js"

describe("resolveStoredDocumentDownload", () => {
  it("uses resolver URLs for storage-backed documents and derives filenames", async () => {
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
        filename: "inv_123.pdf",
      },
    })
  })

  it("uses resolver envelope metadata when provided", async () => {
    const resolver = vi.fn(async () => ({
      url: "https://signed.example.com/custom.pdf",
      expiresAt: "2026-05-23T15:00:00.000Z",
      filename: "custom.pdf",
    }))

    await expect(
      resolveStoredDocumentDownload(
        {
          storageKey: "invoices/inv_123.pdf",
          filename: "fallback.pdf",
        },
        { bindings: {}, resolveDocumentDownloadUrl: resolver },
      ),
    ).resolves.toEqual({
      status: "ready",
      download: {
        url: "https://signed.example.com/custom.pdf",
        expiresAt: "2026-05-23T15:00:00.000Z",
        filename: "custom.pdf",
      },
    })
  })

  it("preserves explicit null expiry from resolver envelopes", async () => {
    const resolver = vi.fn(async () => ({
      url: "https://signed.example.com/no-expiry.pdf",
      expiresAt: null,
    }))

    await expect(
      resolveStoredDocumentDownload(
        {
          storageKey: "invoices/inv_123.pdf",
          metadata: {
            expiresAt: "2026-05-23T14:00:00.000Z",
          },
        },
        { bindings: {}, resolveDocumentDownloadUrl: resolver },
      ),
    ).resolves.toEqual({
      status: "ready",
      download: {
        url: "https://signed.example.com/no-expiry.pdf",
        expiresAt: null,
        filename: "inv_123.pdf",
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
            filename: "metadata-invoice.pdf",
          },
        },
        { bindings: {} },
      ),
    ).resolves.toEqual({
      status: "ready",
      download: {
        url: "https://cdn.example.com/invoice.pdf",
        expiresAt: "2026-05-23T14:00:00.000Z",
        filename: "metadata-invoice.pdf",
      },
    })
  })

  it("reports missing resolver when a storage key has no metadata URL fallback", async () => {
    await expect(
      resolveStoredDocumentDownload({ storageKey: "invoices/inv_123.pdf" }, { bindings: {} }),
    ).resolves.toEqual({ status: "resolver_not_configured" })
  })
})

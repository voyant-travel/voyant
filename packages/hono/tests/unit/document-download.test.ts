import { describe, expect, it, vi } from "vitest"

import {
  createAuthenticatedDocumentDownloadResolver,
  encodeStorageKeyPath,
  resolveStoredDocumentDownload,
} from "../../src/document-download.js"

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

describe("createAuthenticatedDocumentDownloadResolver", () => {
  it("builds authenticated route URLs and encodes storage key path segments", () => {
    const resolver = createAuthenticatedDocumentDownloadResolver<{
      API_BASE_URL: string
    }>({
      apiBaseUrl: (bindings) => bindings.API_BASE_URL,
      routePrefix: "/v1/admin/documents/files/",
    })

    expect(
      resolver(
        {
          API_BASE_URL: "https://api.example.com/",
        },
        "contracts/2026 June/invoice #1.pdf",
      ),
    ).toBe(
      "https://api.example.com/v1/admin/documents/files/contracts/2026%20June/invoice%20%231.pdf",
    )
  })

  it("returns null when the selected storage provider is unavailable", () => {
    const resolver = createAuthenticatedDocumentDownloadResolver({
      apiBaseUrl: "https://api.example.com",
      isAvailable: () => false,
    })

    expect(resolver({}, "contracts/example.pdf")).toBeNull()
  })

  it("does not require vendor bindings", () => {
    const resolver = createAuthenticatedDocumentDownloadResolver({
      apiBaseUrl: "https://api.example.com/api",
      routePrefix: "v1/admin/documents/files",
    })

    expect(resolver({}, "contracts/example.pdf")).toBe(
      "https://api.example.com/api/v1/admin/documents/files/contracts/example.pdf",
    )
  })

  it("returns null when the API base URL is not configured", () => {
    const resolver = createAuthenticatedDocumentDownloadResolver({
      apiBaseUrl: () => "",
    })

    expect(resolver({}, "contracts/example.pdf")).toBeNull()
  })
})

describe("encodeStorageKeyPath", () => {
  it("encodes path segments without flattening folders", () => {
    expect(encodeStorageKeyPath("contracts/2026 June/invoice #1.pdf")).toBe(
      "contracts/2026%20June/invoice%20%231.pdf",
    )
  })
})

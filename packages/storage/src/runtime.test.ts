import { describe, expect, it } from "vitest"

import { resolveDocumentDownloadUrl, type StorageRuntimeEnv } from "./runtime.js"

function env(overrides: StorageRuntimeEnv = {}): StorageRuntimeEnv {
  return {
    DOCUMENTS_BUCKET: {},
    ...overrides,
  }
}

describe("resolveDocumentDownloadUrl", () => {
  it("uses API_BASE_URL so local admin redirects keep the /api mount prefix", async () => {
    await expect(
      resolveDocumentDownloadUrl(
        env({
          APP_URL: "http://localhost:3300",
          API_BASE_URL: "http://localhost:3300/api",
        }),
        "contracts/customer agreement.pdf",
      ),
    ).resolves.toBe(
      "http://localhost:3300/api/v1/admin/documents/files/contracts/customer%20agreement.pdf",
    )
  })

  it("derives the mounted API prefix from an origin-only APP_URL", async () => {
    await expect(
      resolveDocumentDownloadUrl(
        env({
          APP_URL: "http://localhost:3300",
        }),
        "contracts/example.pdf",
      ),
    ).resolves.toBe("http://localhost:3300/api/v1/admin/documents/files/contracts/example.pdf")
  })

  it("preserves an APP_URL that already includes the API mount prefix", async () => {
    await expect(
      resolveDocumentDownloadUrl(
        env({
          APP_URL: "http://localhost:3300/api/",
        }),
        "contracts/example.pdf",
      ),
    ).resolves.toBe("http://localhost:3300/api/v1/admin/documents/files/contracts/example.pdf")
  })
})

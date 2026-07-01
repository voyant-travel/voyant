import type { StorageProvider } from "@voyant-travel/storage"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ContractAttachment } from "../../../src/contracts/schema.js"

const contractServiceMocks = vi.hoisted(() => ({
  deleteAttachment: vi.fn(),
}))

vi.mock("../../../src/contracts/service.js", () => ({
  contractsService: {
    deleteAttachment: contractServiceMocks.deleteAttachment,
  },
}))

const { createContractsAdminRoutes } = await import("../../../src/contracts/routes.js")

const attachment: ContractAttachment = {
  id: "contract_attachments_000000000000000000",
  contractId: "contracts_000000000000000000000000000",
  kind: "document",
  name: "replacement.txt",
  mimeType: "text/plain",
  fileSize: 12,
  storageKey: "contracts/contracts_000000000000000000000000000/attachments/replacement.txt",
  checksum: "sha256:replacement",
  targetKind: null,
  targetId: null,
  targetProvider: null,
  targetSourceRef: null,
  legacyTransactionOfferId: null,
  legacyTransactionOrderId: null,
  metadata: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
}

function createStorage(deleteObject: StorageProvider["delete"]): StorageProvider {
  return {
    name: "test-documents",
    async upload(_body, options = {}) {
      return { key: options.key ?? "uploaded" }
    },
    delete: deleteObject,
    async signedUrl(key) {
      return `https://signed.example.com/${key}`
    },
    async get() {
      return null
    },
  }
}

function createApp(documentStorage: StorageProvider) {
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("db" as never, {} as PostgresJsDatabase)
    await next()
  })
  app.route("/", createContractsAdminRoutes({ documentStorage }))
  return app
}

describe("contract attachment delete storage cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deletes the stored document object for the removed attachment row", async () => {
    const deleteObject = vi.fn<StorageProvider["delete"]>(async () => {})
    contractServiceMocks.deleteAttachment.mockResolvedValue(attachment)

    const res = await createApp(createStorage(deleteObject)).request(
      `/attachments/${attachment.id}`,
      {
        method: "DELETE",
      },
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(contractServiceMocks.deleteAttachment).toHaveBeenCalledWith(
      expect.anything(),
      attachment.id,
    )
    expect(deleteObject).toHaveBeenCalledWith(attachment.storageKey)
  })

  it("does not delete a storage object when the attachment row is missing", async () => {
    const deleteObject = vi.fn<StorageProvider["delete"]>(async () => {})
    contractServiceMocks.deleteAttachment.mockResolvedValue(null)

    const res = await createApp(createStorage(deleteObject)).request(
      `/attachments/${attachment.id}`,
      {
        method: "DELETE",
      },
    )

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Attachment not found" })
    expect(contractServiceMocks.deleteAttachment).toHaveBeenCalledWith(
      expect.anything(),
      attachment.id,
    )
    expect(deleteObject).not.toHaveBeenCalled()
  })
})

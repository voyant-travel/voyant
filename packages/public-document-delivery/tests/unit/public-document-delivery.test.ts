import { createLocalStorageProvider } from "@voyant-travel/storage/providers/local"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import {
  createPublicDocumentDeliveryGrant,
  createPublicDocumentDeliveryRoutes,
  type PublicDocumentDeliveryAccessContext,
  type PublicDocumentDeliveryGrant,
  type PublicDocumentDeliveryGrantStore,
  type RevokePublicDocumentDeliveryGrantInput,
  resolvePublicDocumentDeliveryGrant,
  revokePublicDocumentDeliveryGrant,
} from "../../src/index.js"

function createMemoryGrantStore(): PublicDocumentDeliveryGrantStore & {
  grants: PublicDocumentDeliveryGrant[]
  accesses: PublicDocumentDeliveryAccessContext[]
} {
  const grants: PublicDocumentDeliveryGrant[] = []
  const accesses: PublicDocumentDeliveryAccessContext[] = []

  return {
    grants,
    accesses,
    async create(input) {
      const now = new Date("2026-05-27T12:00:00.000Z")
      const grant: PublicDocumentDeliveryGrant = {
        id: `pddg_${grants.length + 1}`,
        tokenHash: input.tokenHash,
        storageKey: input.storageKey,
        storageProvider: input.storageProvider ?? null,
        filename: input.filename ?? null,
        contentType: input.contentType ?? "application/octet-stream",
        sourceModule: input.sourceModule ?? null,
        sourceEntity: input.sourceEntity ?? null,
        sourceId: input.sourceId ?? null,
        createdBy: input.createdBy ?? null,
        createdByType: input.createdByType ?? null,
        metadata: input.metadata ?? null,
        accessCount: input.accessCount ?? 0,
        lastAccessedAt: input.lastAccessedAt ?? null,
        lastAccessedIp: input.lastAccessedIp ?? null,
        lastAccessedUserAgent: input.lastAccessedUserAgent ?? null,
        revokedAt: input.revokedAt ?? null,
        revokedBy: input.revokedBy ?? null,
        createdAt: input.createdAt ?? now,
        expiresAt: input.expiresAt,
      }
      grants.push(grant)
      return grant
    },
    async findByTokenHash(tokenHash) {
      return grants.find((grant) => grant.tokenHash === tokenHash) ?? null
    },
    async recordAccess(id, context) {
      accesses.push(context)
      const grant = grants.find((candidate) => candidate.id === id)
      if (grant) {
        grant.accessCount += 1
        grant.lastAccessedAt = context.accessedAt
        grant.lastAccessedIp = context.ip
        grant.lastAccessedUserAgent = context.userAgent
      }
    },
    async revoke(input: RevokePublicDocumentDeliveryGrantInput) {
      const grant = grants.find((candidate) => candidate.id === input.id)
      if (!grant || grant.revokedAt) return null
      grant.revokedAt = input.revokedAt ?? new Date()
      grant.revokedBy = input.revokedBy ?? null
      return grant
    },
  }
}

function createRouteApp(options: Parameters<typeof createPublicDocumentDeliveryRoutes>[0]) {
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("db", {})
    await next()
  })
  app.route("/v1/public/documents", createPublicDocumentDeliveryRoutes(options))
  return app
}

describe("public document delivery", () => {
  it("creates opaque single-document URLs and resolves them by token hash", async () => {
    const store = createMemoryGrantStore()
    const envelope = await createPublicDocumentDeliveryGrant(store, {
      storageKey: "invoices/inv_123.pdf",
      publicBaseUrl: "https://docs.example.com/",
      ttlSeconds: 60,
      filename: "invoice.pdf",
      contentType: "application/pdf",
      source: { module: "finance", entity: "invoice_rendition", id: "rend_123" },
      now: new Date("2026-05-27T12:00:00.000Z"),
    })

    expect(envelope).toMatchObject({
      grantId: "pddg_1",
      url: expect.stringMatching(
        /^https:\/\/docs\.example\.com\/v1\/public\/documents\/[A-Za-z0-9_-]+$/,
      ),
      expiresAt: "2026-05-27T12:01:00.000Z",
      filename: "invoice.pdf",
    })
    expect(store.grants[0]).toMatchObject({
      tokenHash: expect.not.stringContaining(envelope.url.split("/").at(-1) ?? ""),
      storageKey: "invoices/inv_123.pdf",
      contentType: "application/pdf",
      sourceModule: "finance",
      sourceEntity: "invoice_rendition",
      sourceId: "rend_123",
    })

    const token = new URL(envelope.url).pathname.split("/").at(-1) ?? ""
    await expect(
      resolvePublicDocumentDeliveryGrant(store, token, new Date("2026-05-27T12:00:30.000Z")),
    ).resolves.toMatchObject({
      status: "ready",
      grant: { storageKey: "invoices/inv_123.pdf" },
    })
  })

  it("serves stored bytes with safe document headers and records access", async () => {
    const store = createMemoryGrantStore()
    const storage = createLocalStorageProvider()
    await storage.upload(new Uint8Array([1, 2, 3]), {
      key: "contracts/contract.pdf",
      contentType: "application/pdf",
    })
    const envelope = await createPublicDocumentDeliveryGrant(store, {
      storageKey: "contracts/contract.pdf",
      publicBaseUrl: "https://docs.example.com",
      filename: 'contract "final".pdf',
      contentType: "application/pdf",
    })

    const app = createRouteApp({ store, storage })
    const path = new URL(envelope.url).pathname
    const res = await app.request(path, {
      headers: {
        "user-agent": "vitest",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(res.headers.get("content-length")).toBe("3")
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="contract -final-.pdf"',
    )
    expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual([1, 2, 3])
    expect(store.grants[0]?.accessCount).toBe(1)
    expect(store.accesses[0]).toMatchObject({
      ip: "203.0.113.10",
      userAgent: "vitest",
    })
  })

  it("does not touch storage for malformed or unknown tokens", async () => {
    let storageReads = 0
    const app = createRouteApp({
      store: createMemoryGrantStore(),
      storage: {
        name: "spy",
        upload: async () => ({ key: "unused", url: "" }),
        delete: async () => {},
        signedUrl: async () => "",
        get: async () => {
          storageReads += 1
          return null
        },
      },
    })

    const malformed = await app.request("/v1/public/documents/not-a-token")
    const unknown = await app.request(
      "/v1/public/documents/abcdefghijklmnopqrstuvwxyzABCDE1234567890_-",
    )

    expect(malformed.status).toBe(404)
    expect(unknown.status).toBe(404)
    expect(storageReads).toBe(0)
  })

  it("falls back to a safe content type when stored metadata is invalid", async () => {
    const store = createMemoryGrantStore()
    const storage = createLocalStorageProvider()
    await storage.upload(new Uint8Array([1]), { key: "documents/file.bin" })
    const envelope = await createPublicDocumentDeliveryGrant(store, {
      storageKey: "documents/file.bin",
      publicBaseUrl: "https://docs.example.com",
      contentType: "application/pdf\r\nx-bad: yes",
    })

    const res = await createRouteApp({ store, storage }).request(new URL(envelope.url).pathname)

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/octet-stream")
  })

  it("returns gone for expired and revoked tokens", async () => {
    const store = createMemoryGrantStore()
    const expired = await createPublicDocumentDeliveryGrant(store, {
      storageKey: "expired.pdf",
      publicBaseUrl: "https://docs.example.com",
      ttlSeconds: 1,
      now: new Date("2020-01-01T00:00:00.000Z"),
    })
    const revoked = await createPublicDocumentDeliveryGrant(store, {
      storageKey: "revoked.pdf",
      publicBaseUrl: "https://docs.example.com",
    })
    await revokePublicDocumentDeliveryGrant(store, {
      id: revoked.grantId,
      revokedAt: new Date("2026-05-27T12:00:00.000Z"),
      revokedBy: "user_1",
    })

    const app = createRouteApp({
      store,
      storage: createLocalStorageProvider(),
    })

    const expiredPath = new URL(expired.url).pathname
    const revokedPath = new URL(revoked.url).pathname

    await expect(
      resolvePublicDocumentDeliveryGrant(
        store,
        expiredPath.split("/").at(-1) ?? "",
        new Date("2026-05-27T12:00:02.000Z"),
      ),
    ).resolves.toMatchObject({ status: "expired" })
    await expect(app.request(expiredPath)).resolves.toMatchObject({ status: 410 })
    await expect(app.request(revokedPath)).resolves.toMatchObject({ status: 410 })
  })
})

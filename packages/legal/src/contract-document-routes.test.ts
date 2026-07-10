import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  CONTRACT_DOCUMENT_ROUTE_PATHS,
  type ContractDocumentRoutesOptions,
  createContractDocumentHonoModule,
  createContractDocumentRoutes,
} from "./contract-document-routes.js"

function stubOptions(
  over: Partial<ContractDocumentRoutesOptions> = {},
): ContractDocumentRoutesOptions {
  return {
    generateContract: vi.fn(async () => ({ contractId: "ctr_123", attachmentId: "att_123" })),
    previewContract: vi.fn(async () => ({
      html: "<p>Preview</p>",
      templateName: "Customer agreement",
      templateLanguage: "en",
    })),
    resolveStorage: vi.fn(() => ({ get: vi.fn(async () => null) })),
    guessMimeType: (key: string) => {
      if (key.endsWith(".pdf")) return "application/pdf"
      if (key.endsWith(".svg")) return "image/svg+xml"
      return "application/octet-stream"
    },
    ...over,
  }
}

function mount(options: ContractDocumentRoutesOptions) {
  const app = new Hono<{ Variables: { db: unknown; eventBus?: unknown } }>()
  app.use("*", async (c, next) => {
    c.set("db", {})
    await next()
  })
  return app.route("/", createContractDocumentRoutes(options))
}

describe("contract document routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exposes the two absolute path matchers", () => {
    expect(CONTRACT_DOCUMENT_ROUTE_PATHS).toEqual([
      "/v1/admin/bookings/:bookingId/generate-contract",
      "/v1/admin/documents/files/*",
    ])
  })

  it("describes the package-owned lazy route module", () => {
    const module = createContractDocumentHonoModule(stubOptions())

    expect(module.module.name).toBe("contract-document")
    expect(module.lazyRoutes?.paths).toBe(CONTRACT_DOCUMENT_ROUTE_PATHS)
    expect(module.lazyRoutes?.load).toBeTypeOf("function")
  })

  it("generate-contract delegates and returns the data", async () => {
    const options = stubOptions()
    const app = mount(options)

    const res = await app.request("/v1/admin/bookings/bk_123/generate-contract", {
      method: "POST",
      body: JSON.stringify({ force: true }),
      headers: { "content-type": "application/json" },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      data: { contractId: "ctr_123", attachmentId: "att_123" },
    })
    expect(options.generateContract).toHaveBeenCalledOnce()
    expect((options.generateContract as ReturnType<typeof vi.fn>).mock.calls[0]?.[3]).toBe("bk_123")
    expect((options.generateContract as ReturnType<typeof vi.fn>).mock.calls[0]?.[4]).toEqual({
      force: true,
    })
  })

  it("generate-contract previews when preview=true", async () => {
    const options = stubOptions()
    const app = mount(options)

    const res = await app.request("/v1/admin/bookings/bk_123/generate-contract", {
      method: "POST",
      body: JSON.stringify({ preview: true }),
      headers: { "content-type": "application/json" },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      data: { html: "<p>Preview</p>", templateName: "Customer agreement", templateLanguage: "en" },
    })
    expect(options.previewContract).toHaveBeenCalledOnce()
  })

  it("documents/files returns 503 when storage is not configured", async () => {
    const app = mount(stubOptions({ resolveStorage: () => null }))

    const res = await app.request("/v1/admin/documents/files/contracts/example.pdf")

    expect(res.status).toBe(503)
  })

  it("documents/files returns 404 when storage has no object", async () => {
    const get = vi.fn(async () => null)
    const app = mount(stubOptions({ resolveStorage: () => ({ get }) }))

    const res = await app.request("/v1/admin/documents/files/contracts/missing.pdf")

    expect(res.status).toBe(404)
    expect(get).toHaveBeenCalledWith("contracts/missing.pdf")
  })

  it("documents/files streams bytes with safe headers when present", async () => {
    const get = vi.fn(async () => new TextEncoder().encode("pdf").buffer)
    const app = mount(stubOptions({ resolveStorage: () => ({ get }) }))

    const res = await app.request("/v1/admin/documents/files/contracts/example.pdf")

    expect(res.status).toBe(200)
    expect(get).toHaveBeenCalledWith("contracts/example.pdf")
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="example.pdf"')
    await expect(res.text()).resolves.toBe("pdf")
  })

  it("forces scriptable document content types to octet-stream", async () => {
    const get = vi.fn(async () => new TextEncoder().encode("<svg />").buffer)
    const app = mount(stubOptions({ resolveStorage: () => ({ get }) }))

    const res = await app.request("/v1/admin/documents/files/contracts/evil.svg")

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/octet-stream")
  })

  it("rejects malformed encoded document keys", async () => {
    const get = vi.fn(async () => new TextEncoder().encode("secret").buffer)
    const app = mount(stubOptions({ resolveStorage: () => ({ get }) }))

    const res = await app.request("/v1/admin/documents/files/contracts/%2Fsecret.pdf")

    expect(res.status).toBe(400)
    expect(get).not.toHaveBeenCalled()
  })
})

import type { EventBus } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { mountOperatorContractDocumentRoutes } from "./contract-document-routes"

type GenerateContractPdfForBooking = (
  env: CloudflareBindings,
  db: PostgresJsDatabase,
  eventBus: EventBus | undefined,
  bookingId: string,
  options?: { force?: boolean },
) => Promise<{ contractId: string; attachmentId: string } | null>

type PreviewContractForBooking = (
  env: CloudflareBindings,
  db: PostgresJsDatabase,
  bookingId: string,
) => Promise<{ html: string; templateName: string; templateLanguage: string } | null>

type TestRouteEnv = {
  Bindings: CloudflareBindings
  Variables: {
    db: PostgresJsDatabase
    eventBus?: EventBus
  }
}

const runtime = vi.hoisted(() => ({
  generateContractPdfForBooking: vi.fn<GenerateContractPdfForBooking>(async () => ({
    contractId: "ctr_123",
    attachmentId: "att_123",
  })),
  previewContractForBooking: vi.fn<PreviewContractForBooking>(async () => ({
    html: "<p>Preview</p>",
    templateName: "Customer agreement",
    templateLanguage: "en",
  })),
}))

const storage = vi.hoisted(() => ({
  createDocumentStorage: vi.fn(),
}))

vi.mock("./contract-document-runtime", () => runtime)
vi.mock("./lib/storage", () => ({
  createDocumentStorage: storage.createDocumentStorage,
  guessMimeType: (key: string) => {
    if (key.endsWith(".pdf")) return "application/pdf"
    if (key.endsWith(".svg")) return "image/svg+xml"
    return "application/octet-stream"
  },
}))

describe("operator contract document routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("dispatches manual contract generation", async () => {
    const app = new Hono<TestRouteEnv>()
    const db = {} as PostgresJsDatabase
    app.use("*", async (c, next) => {
      c.set("db", db)
      await next()
    })
    mountOperatorContractDocumentRoutes(app)

    const response = await app.request("/v1/admin/bookings/bk_123/generate-contract", {
      method: "POST",
      body: JSON.stringify({ force: true }),
      headers: { "content-type": "application/json" },
    })

    await expect(response.json()).resolves.toEqual({
      data: { contractId: "ctr_123", attachmentId: "att_123" },
    })
    expect(runtime.generateContractPdfForBooking).toHaveBeenCalledOnce()
    expect(runtime.generateContractPdfForBooking.mock.calls[0]?.[3]).toBe("bk_123")
    expect(runtime.generateContractPdfForBooking.mock.calls[0]?.[4]).toEqual({ force: true })
  })

  it("dispatches contract preview generation", async () => {
    const app = new Hono<TestRouteEnv>()
    const db = {} as PostgresJsDatabase
    app.use("*", async (c, next) => {
      c.set("db", db)
      await next()
    })
    mountOperatorContractDocumentRoutes(app)

    const response = await app.request("/v1/admin/bookings/bk_123/generate-contract", {
      method: "POST",
      body: JSON.stringify({ preview: true }),
      headers: { "content-type": "application/json" },
    })

    await expect(response.json()).resolves.toEqual({
      data: {
        html: "<p>Preview</p>",
        templateName: "Customer agreement",
        templateLanguage: "en",
      },
    })
    expect(runtime.previewContractForBooking).toHaveBeenCalledOnce()
    expect(runtime.previewContractForBooking.mock.calls[0]?.[2]).toBe("bk_123")
  })

  it("streams private document files as attachments", async () => {
    const app = new Hono<TestRouteEnv>()
    const get = vi.fn(async () => new TextEncoder().encode("pdf").buffer)
    storage.createDocumentStorage.mockReturnValue({ get })
    mountOperatorContractDocumentRoutes(app)

    const response = await app.request("/v1/admin/documents/files/contracts/example.pdf")

    expect(response.status).toBe(200)
    expect(get).toHaveBeenCalledWith("contracts/example.pdf")
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="example.pdf"')
    await expect(response.text()).resolves.toBe("pdf")
  })

  it("forces scriptable document content types to octet-stream", async () => {
    const app = new Hono<TestRouteEnv>()
    storage.createDocumentStorage.mockReturnValue({
      get: vi.fn(async () => new TextEncoder().encode("<svg />").buffer),
    })
    mountOperatorContractDocumentRoutes(app)

    const response = await app.request("/v1/admin/documents/files/contracts/evil.svg")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/octet-stream")
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="evil.svg"')
  })

  it("rejects malformed encoded document keys", async () => {
    const app = new Hono<TestRouteEnv>()
    const get = vi.fn(async () => new TextEncoder().encode("secret").buffer)
    storage.createDocumentStorage.mockReturnValue({ get })
    mountOperatorContractDocumentRoutes(app)

    const response = await app.request("/v1/admin/documents/files/contracts/%2Fsecret.pdf")

    expect(response.status).toBe(400)
    expect(get).not.toHaveBeenCalled()
  })
})

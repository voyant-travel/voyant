import type { EventBus } from "@voyantjs/core"
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

vi.mock("./contract-document-runtime", () => runtime)

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
})

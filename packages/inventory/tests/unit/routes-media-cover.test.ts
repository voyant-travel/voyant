import { Hono } from "hono"
import { afterEach, describe, expect, it, vi } from "vitest"

import { productMediaRoutes } from "../../src/routes-media.js"
import { productsService } from "../../src/service.js"

const db = { test: "db" }

const documentMedia = {
  id: "pmed_document",
  productId: "prod_1",
  dayId: null,
  mediaType: "document",
  name: "Terms PDF",
  url: "https://example.com/terms.pdf",
  storageKey: null,
  mimeType: "application/pdf",
  fileSize: 1024,
  altText: null,
  sortOrder: 0,
  isCover: false,
  isBrochure: false,
  isBrochureCurrent: false,
  brochureVersion: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
} as const

function createApp() {
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("db" as never, db)
    c.set("userId" as never, "usr_products")
    c.set("sessionId" as never, "sess_products")
    c.set("callerType" as never, "session")
    c.set("actor" as never, "staff")
    c.set("organizationId" as never, "org_products")
    await next()
  })
  app.route("/", productMediaRoutes)
  return app
}

describe("product media cover validation", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("rejects setting document media as cover", async () => {
    vi.spyOn(productsService, "getMediaById").mockResolvedValue(documentMedia as never)
    const setCover = vi.spyOn(productsService, "setCoverMedia").mockResolvedValue(null)

    const response = await createApp().request("/media/pmed_document/set-cover", {
      method: "PATCH",
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Only image media can be set as cover" })
    expect(setCover).not.toHaveBeenCalled()
  })

  it("rejects document media created as cover", async () => {
    const createMedia = vi.spyOn(productsService, "createMedia").mockResolvedValue(null)

    const response = await createApp().request("/prod_1/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaType: "document",
        name: "Terms PDF",
        url: "https://example.com/terms.pdf",
        mimeType: "application/pdf",
        sortOrder: 0,
        isCover: true,
      }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Only image media can be set as cover" })
    expect(createMedia).not.toHaveBeenCalled()
  })

  it("rejects updates that mark document media as cover", async () => {
    vi.spyOn(productsService, "getMediaById").mockResolvedValue(documentMedia as never)
    const updateMedia = vi.spyOn(productsService, "updateMedia").mockResolvedValue(null)

    const response = await createApp().request("/media/pmed_document", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaType: "document",
        isCover: true,
      }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Only image media can be set as cover" })
    expect(updateMedia).not.toHaveBeenCalled()
  })
})

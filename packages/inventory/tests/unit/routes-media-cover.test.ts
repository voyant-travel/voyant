import { Hono } from "hono"
import { afterEach, describe, expect, it, vi } from "vitest"

import { productMediaRoutes } from "../../src/routes-media.js"
import { productsService } from "../../src/service.js"
import { ProductOpenGraphMediaError } from "../../src/service-media.js"

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
  width: null,
  height: null,
  altText: null,
  sortOrder: 0,
  isCover: false,
  isOpenGraph: false,
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

  it("rejects a non-image Open Graph media item", async () => {
    const setOpenGraph = vi
      .spyOn(productsService, "setOpenGraphMedia")
      .mockRejectedValue(
        new ProductOpenGraphMediaError(
          "invalid_media_target",
          "Open Graph media must be a product-level image owned by this product",
        ),
      )

    const response = await createApp().request("/prod_1/open-graph-image", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId: documentMedia.id }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "Open Graph media must be a product-level image owned by this product",
    })
    expect(setOpenGraph).toHaveBeenCalledWith(db, "prod_1", documentMedia.id)
  })

  it("rejects an image owned by another product", async () => {
    const setOpenGraph = vi
      .spyOn(productsService, "setOpenGraphMedia")
      .mockRejectedValue(
        new ProductOpenGraphMediaError(
          "invalid_media_target",
          "Open Graph media must be a product-level image owned by this product",
        ),
      )

    const response = await createApp().request("/prod_1/open-graph-image", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId: "pmed_other_image" }),
    })

    expect(response.status).toBe(400)
    expect(setOpenGraph).toHaveBeenCalledWith(db, "prod_1", "pmed_other_image")
  })

  it("returns not found when the transactional service cannot lock the product", async () => {
    vi.spyOn(productsService, "setOpenGraphMedia").mockRejectedValue(
      new ProductOpenGraphMediaError("product_not_found", "Product not found"),
    )

    const response = await createApp().request("/prod_missing/open-graph-image", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId: null }),
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "Product not found" })
  })
})

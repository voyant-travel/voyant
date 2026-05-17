import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"
import { emitProductContentChanged } from "./events.js"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"
import * as validation from "./validation.js"

export const productMediaRoutes = new Hono<Env>()
  // ==========================================================================
  // Media
  // ==========================================================================

  // GET /media/:mediaId — Get single media item
  .get("/media/:mediaId", async (c) => {
    const row = await productsService.getMediaById(c.get("db"), c.req.param("mediaId"))
    if (!row) {
      return c.json({ error: "Media not found" }, 404)
    }
    return c.json({ data: row })
  })

  // PATCH /media/:mediaId — Update media metadata
  .patch("/media/:mediaId", async (c) => {
    const row = await productsService.updateMedia(
      c.get("db"),
      c.req.param("mediaId"),
      await parseJsonBody(c, validation.updateProductMediaSchema),
    )
    if (!row) {
      return c.json({ error: "Media not found" }, 404)
    }
    return c.json({ data: row })
  })

  // PATCH /media/:mediaId/set-cover — Set as cover image
  .patch("/media/:mediaId/set-cover", async (c) => {
    const media = await productsService.getMediaById(c.get("db"), c.req.param("mediaId"))
    if (!media) {
      return c.json({ error: "Media not found" }, 404)
    }
    const row = await productsService.setCoverMedia(
      c.get("db"),
      media.productId,
      media.id,
      media.dayId,
    )
    if (!row) {
      return c.json({ error: "Failed to set cover" }, 500)
    }
    return c.json({ data: row })
  })

  // DELETE /media/:mediaId — Delete media
  .delete("/media/:mediaId", async (c) => {
    const row = await productsService.deleteMedia(c.get("db"), c.req.param("mediaId"))
    if (!row) {
      return c.json({ error: "Media not found" }, 404)
    }
    return c.json({ data: row })
  })

  // GET /:id/brochure — Get canonical brochure for product
  .get("/:id/brochure", async (c) => {
    const row = await productsService.getBrochure(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Product brochure not found" }, 404)
    }
    return c.json({ data: row })
  })

  // GET /:id/brochure/versions — List brochure history for product
  .get("/:id/brochure/versions", async (c) => {
    return c.json({ data: await productsService.listBrochures(c.get("db"), c.req.param("id")) })
  })

  // PUT /:id/brochure — Upsert canonical brochure for product
  .put("/:id/brochure", async (c) => {
    const row = await productsService.upsertBrochure(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.upsertProductBrochureSchema),
    )
    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }
    return c.json({ data: row }, 201)
  })

  // DELETE /:id/brochure — Delete canonical brochure for product
  .delete("/:id/brochure", async (c) => {
    const row = await productsService.deleteBrochure(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Product brochure not found" }, 404)
    }
    return c.json({ data: row })
  })

  // POST /:id/brochure/versions/:brochureId/set-current — Promote brochure version
  .post("/:id/brochure/versions/:brochureId/set-current", async (c) => {
    const row = await productsService.setCurrentBrochure(
      c.get("db"),
      c.req.param("id"),
      c.req.param("brochureId"),
    )
    if (!row) {
      return c.json({ error: "Product brochure version not found" }, 404)
    }
    return c.json({ data: row })
  })

  // DELETE /:id/brochure/versions/:brochureId — Delete brochure version
  .delete("/:id/brochure/versions/:brochureId", async (c) => {
    const row = await productsService.deleteBrochureVersion(
      c.get("db"),
      c.req.param("id"),
      c.req.param("brochureId"),
    )
    if (!row) {
      return c.json({ error: "Product brochure version not found" }, 404)
    }
    return c.json({ data: row })
  })

  // ==========================================================================
  // Product Media (nested under product)
  // ==========================================================================

  // GET /:id/media — List product-level media
  .get("/:id/media", async (c) => {
    const query = parseQuery(c, validation.productMediaListQuerySchema)
    return c.json(
      await productsService.listProductLevelMedia(c.get("db"), c.req.param("id"), query),
    )
  })

  // POST /:id/media — Create media for product
  .post("/:id/media", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.createMedia(
      c.get("db"),
      productId,
      await parseJsonBody(c, validation.insertProductMediaSchema),
    )
    if (!row) {
      return c.json({ error: "Product not found or invalid dayId" }, 404)
    }
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "media" })
    return c.json({ data: row }, 201)
  })

  // POST /:id/media/reorder — Batch reorder media
  .post("/:id/media/reorder", async (c) => {
    const productId = c.req.param("id")
    const data = await parseJsonBody(c, validation.reorderProductMediaSchema)
    const results = await productsService.reorderMedia(c.get("db"), data)
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "media" })
    return c.json({ data: results })
  })

  // GET /:id/days/:dayId/media — List day media
  .get("/:id/days/:dayId/media", async (c) => {
    const query = parseQuery(c, validation.productMediaListQuerySchema)
    return c.json(
      await productsService.listMedia(c.get("db"), c.req.param("id"), {
        ...query,
        dayId: c.req.param("dayId"),
      }),
    )
  })

  // POST /:id/days/:dayId/media — Create day media
  .post("/:id/days/:dayId/media", async (c) => {
    const productId = c.req.param("id")
    const body = await parseJsonBody(c, validation.insertProductMediaSchema)
    const row = await productsService.createMedia(c.get("db"), productId, {
      ...body,
      dayId: c.req.param("dayId"),
    })
    if (!row) {
      return c.json({ error: "Product or day not found" }, 404)
    }
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "media" })
    return c.json({ data: row }, 201)
  })

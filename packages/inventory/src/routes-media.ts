import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import { Hono } from "hono"
import { appendProductMutationLedgerEntry, changedMutationFields } from "./action-ledger.js"
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
    const mediaId = c.req.param("mediaId")
    const body = await parseJsonBody(c, validation.updateProductMediaSchema)
    const before = await productsService.getMediaById(c.get("db"), mediaId)
    if (!before) {
      return c.json({ error: "Media not found" }, 404)
    }

    const row = await productsService.updateMedia(c.get("db"), mediaId, body)

    if (!row) {
      return c.json({ error: "Media not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: before.dayId ? "product day media" : "product media",
      actionName: before.dayId ? "product.day_media.update" : "product.media.update",
      routeOrToolName: before.dayId ? "products.day_media.update" : "products.media.update",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "media" })
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
    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: ["isCover"],
      subject: media.dayId ? "product day media" : "product media",
      actionName: media.dayId ? "product.day_media.set_cover" : "product.media.set_cover",
      routeOrToolName: media.dayId ? "products.day_media.set_cover" : "products.media.set_cover",
      summary: "Set product media as cover",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "media" })
    return c.json({ data: row })
  })

  // DELETE /media/:mediaId — Delete media
  .delete("/media/:mediaId", async (c) => {
    const mediaId = c.req.param("mediaId")
    const before = await productsService.getMediaById(c.get("db"), mediaId)
    if (!before) {
      return c.json({ error: "Media not found" }, 404)
    }

    const row = await productsService.deleteMedia(c.get("db"), mediaId)

    if (!row) {
      return c.json({ error: "Media not found" }, 404)
    }
    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: before.dayId ? "product day media" : "product media",
      actionName: before.dayId ? "product.day_media.delete" : "product.media.delete",
      routeOrToolName: before.dayId ? "products.day_media.delete" : "products.media.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "media" })
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
    const productId = c.req.param("id")
    const body = await parseJsonBody(c, validation.upsertProductBrochureSchema)
    const row = await productsService.upsertBrochure(c.get("db"), productId, body)
    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }
    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product brochure version",
      actionName: "product.brochure.create",
      routeOrToolName: "products.brochure.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "media" })
    return c.json({ data: row }, 201)
  })

  // DELETE /:id/brochure — Delete canonical brochure for product
  .delete("/:id/brochure", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.deleteBrochure(c.get("db"), productId)
    if (!row) {
      return c.json({ error: "Product brochure not found" }, 404)
    }
    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId,
      changedFields: [],
      subject: "product brochure",
      actionName: "product.brochure.delete_current",
      routeOrToolName: "products.brochure.delete_current",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "media" })
    return c.json({ data: row })
  })

  // POST /:id/brochure/versions/:brochureId/set-current — Promote brochure version
  .post("/:id/brochure/versions/:brochureId/set-current", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.setCurrentBrochure(
      c.get("db"),
      productId,
      c.req.param("brochureId"),
    )
    if (!row) {
      return c.json({ error: "Product brochure version not found" }, 404)
    }
    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId,
      changedFields: ["isBrochureCurrent"],
      subject: "product brochure version",
      actionName: "product.brochure.set_current",
      routeOrToolName: "products.brochure.set_current",
      summary: "Set current product brochure version",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "media" })
    return c.json({ data: row })
  })

  // DELETE /:id/brochure/versions/:brochureId — Delete brochure version
  .delete("/:id/brochure/versions/:brochureId", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.deleteBrochureVersion(
      c.get("db"),
      productId,
      c.req.param("brochureId"),
    )
    if (!row) {
      return c.json({ error: "Product brochure version not found" }, 404)
    }
    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId,
      changedFields: [],
      subject: "product brochure version",
      actionName: "product.brochure.delete_version",
      routeOrToolName: "products.brochure.delete_version",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "media" })
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
    const body = await parseJsonBody(c, validation.insertProductMediaSchema)
    const row = await productsService.createMedia(c.get("db"), productId, body)
    if (!row) {
      return c.json({ error: "Product not found or invalid dayId" }, 404)
    }
    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product media",
      actionName: "product.media.create",
      routeOrToolName: "products.media.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "media" })
    return c.json({ data: row }, 201)
  })

  // POST /:id/media/reorder — Batch reorder media
  .post("/:id/media/reorder", async (c) => {
    const productId = c.req.param("id")
    const data = await parseJsonBody(c, validation.reorderProductMediaSchema)
    const results = await productsService.reorderMedia(c.get("db"), data)
    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId,
      changedFields: ["sortOrder"],
      subject: "product media order",
      actionName: "product.media.reorder",
      routeOrToolName: "products.media.reorder",
      summary: `Reordered ${results.length} product media items`,
    })
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
    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product day media",
      actionName: "product.day_media.create",
      routeOrToolName: "products.day_media.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "media" })
    return c.json({ data: row }, 201)
  })

import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"
import { emitProductContentChanged } from "./events.js"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"
import * as validation from "./validation.js"

export const productTranslationRoutes = new Hono<Env>()
  // ==========================================================================
  // Translations
  // ==========================================================================

  .get("/translations", async (c) => {
    const query = parseQuery(c, validation.productTranslationListQuerySchema)
    return c.json(await productsService.listProductTranslations(c.get("db"), query))
  })

  .get("/translations/:translationId", async (c) => {
    const row = await productsService.getProductTranslationById(
      c.get("db"),
      c.req.param("translationId"),
    )

    if (!row) {
      return c.json({ error: "Product translation not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/:id/translations", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.createProductTranslation(
      c.get("db"),
      productId,
      await parseJsonBody(c, validation.insertProductTranslationSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "translation" })
    return c.json({ data: row }, 201)
  })

  .patch("/translations/:translationId", async (c) => {
    const row = await productsService.updateProductTranslation(
      c.get("db"),
      c.req.param("translationId"),
      await parseJsonBody(c, validation.updateProductTranslationSchema),
    )

    if (!row) {
      return c.json({ error: "Product translation not found" }, 404)
    }

    if (row.productId) {
      await emitProductContentChanged(c.get("eventBus"), {
        id: row.productId,
        axis: "translation",
      })
    }
    return c.json({ data: row })
  })

  .delete("/translations/:translationId", async (c) => {
    const row = await productsService.deleteProductTranslation(
      c.get("db"),
      c.req.param("translationId"),
    )

    if (!row) {
      return c.json({ error: "Product translation not found" }, 404)
    }

    if ("productId" in row && typeof row.productId === "string") {
      await emitProductContentChanged(c.get("eventBus"), {
        id: row.productId,
        axis: "translation",
      })
    }
    return c.json({ success: true }, 200)
  })

  .get("/option-translations", async (c) => {
    const query = parseQuery(c, validation.productOptionTranslationListQuerySchema)
    return c.json(await productsService.listOptionTranslations(c.get("db"), query))
  })

  .get("/option-translations/:translationId", async (c) => {
    const row = await productsService.getOptionTranslationById(
      c.get("db"),
      c.req.param("translationId"),
    )

    if (!row) {
      return c.json({ error: "Option translation not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/options/:optionId/translations", async (c) => {
    const row = await productsService.createOptionTranslation(
      c.get("db"),
      c.req.param("optionId"),
      await parseJsonBody(c, validation.insertProductOptionTranslationSchema),
    )

    if (!row) {
      return c.json({ error: "Product option not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/option-translations/:translationId", async (c) => {
    const row = await productsService.updateOptionTranslation(
      c.get("db"),
      c.req.param("translationId"),
      await parseJsonBody(c, validation.updateProductOptionTranslationSchema),
    )

    if (!row) {
      return c.json({ error: "Option translation not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/option-translations/:translationId", async (c) => {
    const row = await productsService.deleteOptionTranslation(
      c.get("db"),
      c.req.param("translationId"),
    )

    if (!row) {
      return c.json({ error: "Option translation not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  .get("/unit-translations", async (c) => {
    const query = parseQuery(c, validation.optionUnitTranslationListQuerySchema)
    return c.json(await productsService.listUnitTranslations(c.get("db"), query))
  })

  .get("/unit-translations/:translationId", async (c) => {
    const row = await productsService.getUnitTranslationById(
      c.get("db"),
      c.req.param("translationId"),
    )

    if (!row) {
      return c.json({ error: "Unit translation not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/units/:unitId/translations", async (c) => {
    const row = await productsService.createUnitTranslation(
      c.get("db"),
      c.req.param("unitId"),
      await parseJsonBody(c, validation.insertOptionUnitTranslationSchema),
    )

    if (!row) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/unit-translations/:translationId", async (c) => {
    const row = await productsService.updateUnitTranslation(
      c.get("db"),
      c.req.param("translationId"),
      await parseJsonBody(c, validation.updateOptionUnitTranslationSchema),
    )

    if (!row) {
      return c.json({ error: "Unit translation not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/unit-translations/:translationId", async (c) => {
    const row = await productsService.deleteUnitTranslation(
      c.get("db"),
      c.req.param("translationId"),
    )

    if (!row) {
      return c.json({ error: "Unit translation not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

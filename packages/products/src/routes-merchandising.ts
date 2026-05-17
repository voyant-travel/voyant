import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"
import { emitProductContentChanged } from "./events.js"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"
import * as validation from "./validation.js"

export const productMerchandisingRoutes = new Hono<Env>()
  .get("/features", async (c) => {
    const query = parseQuery(c, validation.productFeatureListQuerySchema)
    return c.json(await productsService.listFeatures(c.get("db"), query))
  })

  .get("/features/:id", async (c) => {
    const row = await productsService.getFeatureById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Product feature not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/:id/features", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.createFeature(
      c.get("db"),
      productId,
      await parseJsonBody(c, validation.insertProductFeatureSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "feature" })
    return c.json({ data: row }, 201)
  })

  .patch("/features/:id", async (c) => {
    const row = await productsService.updateFeature(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.updateProductFeatureSchema),
    )

    if (!row) {
      return c.json({ error: "Product feature not found" }, 404)
    }

    if (row.productId) {
      await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "feature" })
    }
    return c.json({ data: row })
  })

  .delete("/features/:id", async (c) => {
    const row = await productsService.deleteFeature(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product feature not found" }, 404)
    }

    if ("productId" in row && typeof row.productId === "string") {
      await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "feature" })
    }
    return c.json({ success: true }, 200)
  })

  .get("/faqs", async (c) => {
    const query = parseQuery(c, validation.productFaqListQuerySchema)
    return c.json(await productsService.listFaqs(c.get("db"), query))
  })

  .get("/faqs/:id", async (c) => {
    const row = await productsService.getFaqById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Product FAQ not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/:id/faqs", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.createFaq(
      c.get("db"),
      productId,
      await parseJsonBody(c, validation.insertProductFaqSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "faq" })
    return c.json({ data: row }, 201)
  })

  .patch("/faqs/:id", async (c) => {
    const row = await productsService.updateFaq(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.updateProductFaqSchema),
    )

    if (!row) {
      return c.json({ error: "Product FAQ not found" }, 404)
    }

    if (row.productId) {
      await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "faq" })
    }
    return c.json({ data: row })
  })

  .delete("/faqs/:id", async (c) => {
    const row = await productsService.deleteFaq(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product FAQ not found" }, 404)
    }
    if ("productId" in row && typeof row.productId === "string") {
      await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "faq" })
    }

    return c.json({ success: true }, 200)
  })

  .get("/locations", async (c) => {
    const query = parseQuery(c, validation.productLocationListQuerySchema)
    return c.json(await productsService.listLocations(c.get("db"), query))
  })

  .get("/locations/:id", async (c) => {
    const row = await productsService.getLocationById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Product location not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/:id/locations", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.createLocation(
      c.get("db"),
      productId,
      await parseJsonBody(c, validation.insertProductLocationSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "location" })
    return c.json({ data: row }, 201)
  })

  .patch("/locations/:id", async (c) => {
    const row = await productsService.updateLocation(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.updateProductLocationSchema),
    )

    if (!row) {
      return c.json({ error: "Product location not found" }, 404)
    }

    if (row.productId) {
      await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "location" })
    }
    return c.json({ data: row })
  })

  .delete("/locations/:id", async (c) => {
    const row = await productsService.deleteLocation(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product location not found" }, 404)
    }

    if ("productId" in row && typeof row.productId === "string") {
      await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "location" })
    }
    return c.json({ success: true }, 200)
  })

  .get("/destinations", async (c) => {
    const query = parseQuery(c, validation.destinationListQuerySchema)
    return c.json(await productsService.listDestinations(c.get("db"), query))
  })

  .get("/destinations/:id", async (c) => {
    const row = await productsService.getDestinationById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Destination not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/destinations", async (c) => {
    const row = await productsService.createDestination(
      c.get("db"),
      await parseJsonBody(c, validation.insertDestinationSchema),
    )

    return c.json({ data: row }, 201)
  })

  .patch("/destinations/:id", async (c) => {
    const row = await productsService.updateDestination(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.updateDestinationSchema),
    )

    if (!row) {
      return c.json({ error: "Destination not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/destinations/:id", async (c) => {
    const row = await productsService.deleteDestination(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Destination not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  .get("/destination-translations", async (c) => {
    const query = parseQuery(c, validation.destinationTranslationListQuerySchema)
    return c.json(await productsService.listDestinationTranslations(c.get("db"), query))
  })

  .post("/destinations/:id/translations", async (c) => {
    const row = await productsService.upsertDestinationTranslation(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.insertDestinationTranslationSchema),
    )

    if (!row) {
      return c.json({ error: "Destination not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/destination-translations/:id", async (c) => {
    const row = await productsService.updateDestinationTranslation(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.updateDestinationTranslationSchema),
    )

    if (!row) {
      return c.json({ error: "Destination translation not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/destination-translations/:id", async (c) => {
    const row = await productsService.deleteDestinationTranslation(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Destination translation not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Product category translations (locale-aware names + descriptions).
  // Mirrors the destinations translation surface above. The catalog plane's
  // taxonomy projection reads these per-slice locale and falls back to
  // `productCategories.name` when no row exists for a given locale.
  // ──────────────────────────────────────────────────────────────────────────

  .get("/product-category-translations", async (c) => {
    const query = parseQuery(c, validation.productCategoryTranslationListQuerySchema)
    return c.json(await productsService.listProductCategoryTranslations(c.get("db"), query))
  })

  .post("/product-categories/:id/translations", async (c) => {
    const row = await productsService.upsertProductCategoryTranslation(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.insertProductCategoryTranslationSchema),
    )

    if (!row) {
      return c.json({ error: "Product category not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/product-category-translations/:id", async (c) => {
    const row = await productsService.updateProductCategoryTranslation(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.updateProductCategoryTranslationSchema),
    )

    if (!row) {
      return c.json({ error: "Product category translation not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/product-category-translations/:id", async (c) => {
    const row = await productsService.deleteProductCategoryTranslation(
      c.get("db"),
      c.req.param("id"),
    )

    if (!row) {
      return c.json({ error: "Product category translation not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Product tag translations. Slimmer shape — tags are short labels with no
  // description / SEO blurbs (per #502 non-goals).
  // ──────────────────────────────────────────────────────────────────────────

  .get("/product-tag-translations", async (c) => {
    const query = parseQuery(c, validation.productTagTranslationListQuerySchema)
    return c.json(await productsService.listProductTagTranslations(c.get("db"), query))
  })

  .post("/product-tags/:id/translations", async (c) => {
    const row = await productsService.upsertProductTagTranslation(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.insertProductTagTranslationSchema),
    )

    if (!row) {
      return c.json({ error: "Product tag not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/product-tag-translations/:id", async (c) => {
    const row = await productsService.updateProductTagTranslation(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.updateProductTagTranslationSchema),
    )

    if (!row) {
      return c.json({ error: "Product tag translation not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/product-tag-translations/:id", async (c) => {
    const row = await productsService.deleteProductTagTranslation(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product tag translation not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  .get("/destination-links", async (c) => {
    const query = parseQuery(c, validation.productDestinationListQuerySchema)
    return c.json(await productsService.listProductDestinations(c.get("db"), query))
  })

  .post("/:id/destinations", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.assignProductDestination(
      c.get("db"),
      productId,
      await parseJsonBody(c, validation.insertProductDestinationSchema),
    )

    if (!row) {
      return c.json({ error: "Product or destination not found" }, 404)
    }

    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "destination" })
    return c.json({ data: row }, 201)
  })

  .delete("/:id/destinations/:destinationId", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.removeProductDestination(
      c.get("db"),
      productId,
      c.req.param("destinationId"),
    )

    if (!row) {
      return c.json({ error: "Product destination link not found" }, 404)
    }

    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "destination" })
    return c.json({ success: true }, 200)
  })

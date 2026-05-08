import { parseJsonBody, parseQuery, RequestValidationError, requireUserId } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { z } from "zod"

import { emitProductContentChanged } from "./events.js"
import { productsService } from "./service.js"
import {
  destinationListQuerySchema,
  destinationTranslationListQuerySchema,
  duplicateItinerarySchema,
  insertDaySchema,
  insertDayServiceSchema,
  insertDestinationSchema,
  insertDestinationTranslationSchema,
  insertItinerarySchema,
  insertOptionUnitSchema,
  insertOptionUnitTranslationSchema,
  insertProductActivationSettingSchema,
  insertProductCapabilitySchema,
  insertProductCategorySchema,
  insertProductDeliveryFormatSchema,
  insertProductDestinationSchema,
  insertProductFaqSchema,
  insertProductFeatureSchema,
  insertProductLocationSchema,
  insertProductMediaSchema,
  insertProductNoteSchema,
  insertProductOptionSchema,
  insertProductOptionTranslationSchema,
  insertProductSchema,
  insertProductTagSchema,
  insertProductTicketSettingSchema,
  insertProductTranslationSchema,
  insertProductTypeSchema,
  insertProductVisibilitySettingSchema,
  insertVersionSchema,
  optionUnitListQuerySchema,
  optionUnitTranslationListQuerySchema,
  productActivationSettingListQuerySchema,
  productAggregatesQuerySchema,
  productCapabilityListQuerySchema,
  productCategoryListQuerySchema,
  productDeliveryFormatListQuerySchema,
  productDestinationListQuerySchema,
  productFaqListQuerySchema,
  productFeatureListQuerySchema,
  productListQuerySchema,
  productLocationListQuerySchema,
  productMediaListQuerySchema,
  productOptionListQuerySchema,
  productOptionTranslationListQuerySchema,
  productTagListQuerySchema,
  productTicketSettingListQuerySchema,
  productTranslationListQuerySchema,
  productTypeListQuerySchema,
  productVisibilitySettingListQuerySchema,
  reorderProductMediaSchema,
  updateDaySchema,
  updateDayServiceSchema,
  updateDestinationSchema,
  updateDestinationTranslationSchema,
  updateItinerarySchema,
  updateOptionUnitSchema,
  updateOptionUnitTranslationSchema,
  updateProductActivationSettingSchema,
  updateProductCapabilitySchema,
  updateProductCategorySchema,
  updateProductDeliveryFormatSchema,
  updateProductFaqSchema,
  updateProductFeatureSchema,
  updateProductLocationSchema,
  updateProductMediaSchema,
  updateProductOptionSchema,
  updateProductOptionTranslationSchema,
  updateProductSchema,
  updateProductTagSchema,
  updateProductTicketSettingSchema,
  updateProductTranslationSchema,
  updateProductTypeSchema,
  updateProductVisibilitySettingSchema,
  upsertProductBrochureSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
    eventBus?: import("@voyantjs/core").EventBus
  }
}

// ==========================================================================
// Products — method-chained routes for Hono RPC type inference
// ==========================================================================

export const productRoutes = new Hono<Env>()

  // GET /aggregates — dashboard KPIs (before /:id so the matcher doesn't swallow it)
  .get("/aggregates", async (c) => {
    const query = parseQuery(c, productAggregatesQuerySchema)
    return c.json({ data: await productsService.getProductAggregates(c.get("db"), query) })
  })

  // GET / — List products
  .get("/", async (c) => {
    const query = parseQuery(c, productListQuerySchema)
    return c.json(await productsService.listProducts(c.get("db"), query))
  })

  // POST / — Create product
  .post("/", async (c) => {
    const row = await productsService.createProduct(
      c.get("db"),
      await parseJsonBody(c, insertProductSchema),
    )
    await c.get("eventBus")?.emit("product.created", { id: row.id })
    return c.json({ data: row }, 201)
  })

  // ==========================================================================
  // Product operating configuration
  // ==========================================================================

  .get("/activation-settings", async (c) => {
    const query = parseQuery(c, productActivationSettingListQuerySchema)
    return c.json(await productsService.listActivationSettings(c.get("db"), query))
  })

  .get("/activation-settings/:id", async (c) => {
    const row = await productsService.getActivationSettingById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Product activation setting not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/:id/activation-settings", async (c) => {
    const row = await productsService.upsertActivationSetting(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertProductActivationSettingSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/activation-settings/:id", async (c) => {
    const row = await productsService.updateActivationSetting(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateProductActivationSettingSchema),
    )

    if (!row) {
      return c.json({ error: "Product activation setting not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/activation-settings/:id", async (c) => {
    const row = await productsService.deleteActivationSetting(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product activation setting not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  .get("/ticket-settings", async (c) => {
    const query = parseQuery(c, productTicketSettingListQuerySchema)
    return c.json(await productsService.listTicketSettings(c.get("db"), query))
  })

  .get("/ticket-settings/:id", async (c) => {
    const row = await productsService.getTicketSettingById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Product ticket setting not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/:id/ticket-settings", async (c) => {
    const row = await productsService.upsertTicketSetting(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertProductTicketSettingSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/ticket-settings/:id", async (c) => {
    const row = await productsService.updateTicketSetting(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateProductTicketSettingSchema),
    )

    if (!row) {
      return c.json({ error: "Product ticket setting not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/ticket-settings/:id", async (c) => {
    const row = await productsService.deleteTicketSetting(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product ticket setting not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  .get("/visibility-settings", async (c) => {
    const query = parseQuery(c, productVisibilitySettingListQuerySchema)
    return c.json(await productsService.listVisibilitySettings(c.get("db"), query))
  })

  .get("/visibility-settings/:id", async (c) => {
    const row = await productsService.getVisibilitySettingById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Product visibility setting not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/:id/visibility-settings", async (c) => {
    const row = await productsService.upsertVisibilitySetting(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertProductVisibilitySettingSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/visibility-settings/:id", async (c) => {
    const row = await productsService.updateVisibilitySetting(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateProductVisibilitySettingSchema),
    )

    if (!row) {
      return c.json({ error: "Product visibility setting not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/visibility-settings/:id", async (c) => {
    const row = await productsService.deleteVisibilitySetting(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product visibility setting not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  .get("/capabilities", async (c) => {
    const query = parseQuery(c, productCapabilityListQuerySchema)
    return c.json(await productsService.listCapabilities(c.get("db"), query))
  })

  .get("/capabilities/:id", async (c) => {
    const row = await productsService.getCapabilityById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Product capability not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/:id/capabilities", async (c) => {
    const row = await productsService.createCapability(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertProductCapabilitySchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/capabilities/:id", async (c) => {
    const row = await productsService.updateCapability(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateProductCapabilitySchema),
    )

    if (!row) {
      return c.json({ error: "Product capability not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/capabilities/:id", async (c) => {
    const row = await productsService.deleteCapability(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product capability not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  .get("/delivery-formats", async (c) => {
    const query = parseQuery(c, productDeliveryFormatListQuerySchema)
    return c.json(await productsService.listDeliveryFormats(c.get("db"), query))
  })

  .get("/delivery-formats/:id", async (c) => {
    const row = await productsService.getDeliveryFormatById(c.get("db"), c.req.param("id"))
    if (!row) {
      return c.json({ error: "Product delivery format not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/:id/delivery-formats", async (c) => {
    const row = await productsService.createDeliveryFormat(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertProductDeliveryFormatSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/delivery-formats/:id", async (c) => {
    const row = await productsService.updateDeliveryFormat(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateProductDeliveryFormatSchema),
    )

    if (!row) {
      return c.json({ error: "Product delivery format not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/delivery-formats/:id", async (c) => {
    const row = await productsService.deleteDeliveryFormat(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product delivery format not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  .get("/features", async (c) => {
    const query = parseQuery(c, productFeatureListQuerySchema)
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
      await parseJsonBody(c, insertProductFeatureSchema),
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
      await parseJsonBody(c, updateProductFeatureSchema),
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
    const query = parseQuery(c, productFaqListQuerySchema)
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
      await parseJsonBody(c, insertProductFaqSchema),
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
      await parseJsonBody(c, updateProductFaqSchema),
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
    const query = parseQuery(c, productLocationListQuerySchema)
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
      await parseJsonBody(c, insertProductLocationSchema),
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
      await parseJsonBody(c, updateProductLocationSchema),
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
    const query = parseQuery(c, destinationListQuerySchema)
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
      await parseJsonBody(c, insertDestinationSchema),
    )

    return c.json({ data: row }, 201)
  })

  .patch("/destinations/:id", async (c) => {
    const row = await productsService.updateDestination(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateDestinationSchema),
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
    const query = parseQuery(c, destinationTranslationListQuerySchema)
    return c.json(await productsService.listDestinationTranslations(c.get("db"), query))
  })

  .post("/destinations/:id/translations", async (c) => {
    const row = await productsService.upsertDestinationTranslation(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertDestinationTranslationSchema),
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
      await parseJsonBody(c, updateDestinationTranslationSchema),
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

  .get("/destination-links", async (c) => {
    const query = parseQuery(c, productDestinationListQuerySchema)
    return c.json(await productsService.listProductDestinations(c.get("db"), query))
  })

  .post("/:id/destinations", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.assignProductDestination(
      c.get("db"),
      productId,
      await parseJsonBody(c, insertProductDestinationSchema),
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

  // ==========================================================================
  // Options
  // ==========================================================================

  // GET /options — List options
  .get("/options", async (c) => {
    const query = parseQuery(c, productOptionListQuerySchema)
    return c.json(await productsService.listOptions(c.get("db"), query))
  })

  // GET /options/:optionId — Get single option
  .get("/options/:optionId", async (c) => {
    const row = await productsService.getOptionById(c.get("db"), c.req.param("optionId"))

    if (!row) {
      return c.json({ error: "Product option not found" }, 404)
    }

    return c.json({ data: row })
  })

  // POST /:id/options — Create option for product
  .post("/:id/options", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.createOption(
      c.get("db"),
      productId,
      await parseJsonBody(c, insertProductOptionSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "option" })
    return c.json({ data: row }, 201)
  })

  // PATCH /options/:optionId — Update option
  .patch("/options/:optionId", async (c) => {
    const row = await productsService.updateOption(
      c.get("db"),
      c.req.param("optionId"),
      await parseJsonBody(c, updateProductOptionSchema),
    )

    if (!row) {
      return c.json({ error: "Product option not found" }, 404)
    }

    if (row.productId) {
      await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "option" })
    }
    return c.json({ data: row })
  })

  // DELETE /options/:optionId — Delete option
  .delete("/options/:optionId", async (c) => {
    const row = await productsService.deleteOption(c.get("db"), c.req.param("optionId"))

    if (!row) {
      return c.json({ error: "Product option not found" }, 404)
    }

    if ("productId" in row && typeof row.productId === "string") {
      await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "option" })
    }
    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Option Units
  // ==========================================================================

  // GET /units — List units
  .get("/units", async (c) => {
    const query = parseQuery(c, optionUnitListQuerySchema)
    return c.json(await productsService.listUnits(c.get("db"), query))
  })

  // GET /units/:unitId — Get single unit
  .get("/units/:unitId", async (c) => {
    const row = await productsService.getUnitById(c.get("db"), c.req.param("unitId"))

    if (!row) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    return c.json({ data: row })
  })

  // POST /options/:optionId/units — Create unit for option
  .post("/options/:optionId/units", async (c) => {
    const row = await productsService.createUnit(
      c.get("db"),
      c.req.param("optionId"),
      await parseJsonBody(c, insertOptionUnitSchema),
    )

    if (!row) {
      return c.json({ error: "Product option not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // PATCH /units/:unitId — Update unit
  .patch("/units/:unitId", async (c) => {
    const row = await productsService.updateUnit(
      c.get("db"),
      c.req.param("unitId"),
      await parseJsonBody(c, updateOptionUnitSchema),
    )

    if (!row) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    return c.json({ data: row })
  })

  // DELETE /units/:unitId — Delete unit
  .delete("/units/:unitId", async (c) => {
    const row = await productsService.deleteUnit(c.get("db"), c.req.param("unitId"))

    if (!row) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Translations
  // ==========================================================================

  .get("/translations", async (c) => {
    const query = parseQuery(c, productTranslationListQuerySchema)
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
      await parseJsonBody(c, insertProductTranslationSchema),
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
      await parseJsonBody(c, updateProductTranslationSchema),
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
    const query = parseQuery(c, productOptionTranslationListQuerySchema)
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
      await parseJsonBody(c, insertProductOptionTranslationSchema),
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
      await parseJsonBody(c, updateProductOptionTranslationSchema),
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
    const query = parseQuery(c, optionUnitTranslationListQuerySchema)
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
      await parseJsonBody(c, insertOptionUnitTranslationSchema),
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
      await parseJsonBody(c, updateOptionUnitTranslationSchema),
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

  // ==========================================================================
  // Product Types
  // ==========================================================================

  .get("/product-types", async (c) => {
    const query = parseQuery(c, productTypeListQuerySchema)
    return c.json(await productsService.listProductTypes(c.get("db"), query))
  })

  .get("/product-types/:typeId", async (c) => {
    const row = await productsService.getProductTypeById(c.get("db"), c.req.param("typeId"))
    if (!row) {
      return c.json({ error: "Product type not found" }, 404)
    }
    return c.json({ data: row })
  })

  .post("/product-types", async (c) => {
    return c.json(
      {
        data: await productsService.createProductType(
          c.get("db"),
          await parseJsonBody(c, insertProductTypeSchema),
        ),
      },
      201,
    )
  })

  .patch("/product-types/:typeId", async (c) => {
    const row = await productsService.updateProductType(
      c.get("db"),
      c.req.param("typeId"),
      await parseJsonBody(c, updateProductTypeSchema),
    )
    if (!row) {
      return c.json({ error: "Product type not found" }, 404)
    }
    return c.json({ data: row })
  })

  .delete("/product-types/:typeId", async (c) => {
    const row = await productsService.deleteProductType(c.get("db"), c.req.param("typeId"))
    if (!row) {
      return c.json({ error: "Product type not found" }, 404)
    }
    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Product Categories
  // ==========================================================================

  .get("/product-categories", async (c) => {
    const query = parseQuery(c, productCategoryListQuerySchema)
    return c.json(await productsService.listProductCategories(c.get("db"), query))
  })

  .get("/product-categories/:categoryId", async (c) => {
    const row = await productsService.getProductCategoryById(c.get("db"), c.req.param("categoryId"))
    if (!row) {
      return c.json({ error: "Product category not found" }, 404)
    }
    return c.json({ data: row })
  })

  .post("/product-categories", async (c) => {
    return c.json(
      {
        data: await productsService.createProductCategory(
          c.get("db"),
          await parseJsonBody(c, insertProductCategorySchema),
        ),
      },
      201,
    )
  })

  .patch("/product-categories/:categoryId", async (c) => {
    const row = await productsService.updateProductCategory(
      c.get("db"),
      c.req.param("categoryId"),
      await parseJsonBody(c, updateProductCategorySchema),
    )
    if (!row) {
      return c.json({ error: "Product category not found" }, 404)
    }
    return c.json({ data: row })
  })

  .delete("/product-categories/:categoryId", async (c) => {
    const row = await productsService.deleteProductCategory(c.get("db"), c.req.param("categoryId"))
    if (!row) {
      return c.json({ error: "Product category not found" }, 404)
    }
    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Product Tags
  // ==========================================================================

  .get("/product-tags", async (c) => {
    const query = parseQuery(c, productTagListQuerySchema)
    return c.json(await productsService.listProductTags(c.get("db"), query))
  })

  .get("/product-tags/:tagId", async (c) => {
    const row = await productsService.getProductTagById(c.get("db"), c.req.param("tagId"))
    if (!row) {
      return c.json({ error: "Product tag not found" }, 404)
    }
    return c.json({ data: row })
  })

  .post("/product-tags", async (c) => {
    return c.json(
      {
        data: await productsService.createProductTag(
          c.get("db"),
          await parseJsonBody(c, insertProductTagSchema),
        ),
      },
      201,
    )
  })

  .patch("/product-tags/:tagId", async (c) => {
    const row = await productsService.updateProductTag(
      c.get("db"),
      c.req.param("tagId"),
      await parseJsonBody(c, updateProductTagSchema),
    )
    if (!row) {
      return c.json({ error: "Product tag not found" }, 404)
    }
    return c.json({ data: row })
  })

  .delete("/product-tags/:tagId", async (c) => {
    const row = await productsService.deleteProductTag(c.get("db"), c.req.param("tagId"))
    if (!row) {
      return c.json({ error: "Product tag not found" }, 404)
    }
    return c.json({ success: true }, 200)
  })

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
      await parseJsonBody(c, updateProductMediaSchema),
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
      await parseJsonBody(c, upsertProductBrochureSchema),
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

  // GET /:id — Get single product
  .get("/:id", async (c) => {
    const row = await productsService.getProductById(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row })
  })

  // PATCH /:id — Update product
  .patch("/:id", async (c) => {
    const row = await productsService.updateProduct(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, updateProductSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await c.get("eventBus")?.emit("product.updated", { id: row.id })
    await emitProductContentChanged(c.get("eventBus"), { id: row.id, axis: "product" })
    return c.json({ data: row })
  })

  // DELETE /:id — Delete product
  .delete("/:id", async (c) => {
    const row = await productsService.deleteProduct(c.get("db"), c.req.param("id"))

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await c.get("eventBus")?.emit("product.deleted", { id: row.id })
    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Itineraries
  // ==========================================================================

  .get("/:id/itineraries", async (c) => {
    return c.json({ data: await productsService.listItineraries(c.get("db"), c.req.param("id")) })
  })

  .post("/:id/itineraries", async (c) => {
    const row = await productsService.createItinerary(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, insertItinerarySchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  .patch("/itineraries/:itineraryId", async (c) => {
    const row = await productsService.updateItinerary(
      c.get("db"),
      c.req.param("itineraryId"),
      await parseJsonBody(c, updateItinerarySchema),
    )

    if (!row) {
      return c.json({ error: "Itinerary not found" }, 404)
    }

    return c.json({ data: row })
  })

  .delete("/itineraries/:itineraryId", async (c) => {
    const row = await productsService.deleteItinerary(c.get("db"), c.req.param("itineraryId"))

    if (!row) {
      return c.json({ error: "Itinerary not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

  .post("/itineraries/:itineraryId/duplicate", async (c) => {
    const body = await parseJsonBody(c, duplicateItinerarySchema)
    const row = await productsService.duplicateItinerary(
      c.get("db"),
      c.req.param("itineraryId"),
      body,
    )

    if (!row) {
      return c.json({ error: "Itinerary not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // ==========================================================================
  // Days
  // ==========================================================================

  .get("/:id/itineraries/:itineraryId/days", async (c) => {
    return c.json({
      data: await productsService.listItineraryDays(c.get("db"), c.req.param("itineraryId")),
    })
  })

  .post("/:id/itineraries/:itineraryId/days", async (c) => {
    const row = await productsService.createItineraryDay(
      c.get("db"),
      c.req.param("id"),
      c.req.param("itineraryId"),
      await parseJsonBody(c, insertDaySchema),
    )

    if (!row) {
      return c.json({ error: "Itinerary not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // GET /:id/days — List days for product
  .get("/:id/days", async (c) => {
    return c.json({ data: await productsService.listDays(c.get("db"), c.req.param("id")) })
  })

  // POST /:id/days — Add day to product
  .post("/:id/days", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.createDay(
      c.get("db"),
      productId,
      await parseJsonBody(c, insertDaySchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "day" })
    return c.json({ data: row }, 201)
  })

  // PATCH /:id/days/:dayId — Update day
  .patch("/:id/days/:dayId", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.updateDay(
      c.get("db"),
      c.req.param("dayId"),
      await parseJsonBody(c, updateDaySchema),
    )

    if (!row) {
      return c.json({ error: "Day not found" }, 404)
    }

    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "day" })
    return c.json({ data: row })
  })

  // DELETE /:id/days/:dayId — Delete day
  .delete("/:id/days/:dayId", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.deleteDay(c.get("db"), c.req.param("dayId"))

    if (!row) {
      return c.json({ error: "Day not found" }, 404)
    }

    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "day" })
    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Day Services
  // ==========================================================================

  // GET /:id/days/:dayId/services — List services for a day
  .get("/:id/days/:dayId/services", async (c) => {
    return c.json({
      data: await productsService.listDayServices(c.get("db"), c.req.param("dayId")),
    })
  })

  // POST /:id/days/:dayId/services — Add service to day
  .post("/:id/days/:dayId/services", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.createDayService(
      c.get("db"),
      productId,
      c.req.param("dayId"),
      await parseJsonBody(c, insertDayServiceSchema),
    )

    if (!row) {
      return c.json({ error: "Day not found" }, 404)
    }

    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "day" })
    return c.json({ data: row }, 201)
  })

  // PATCH /:id/days/:dayId/services/:serviceId — Update service
  .patch("/:id/days/:dayId/services/:serviceId", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.updateDayService(
      c.get("db"),
      productId,
      c.req.param("serviceId"),
      await parseJsonBody(c, updateDayServiceSchema),
    )

    if (!row) {
      return c.json({ error: "Service not found" }, 404)
    }

    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "day" })
    return c.json({ data: row })
  })

  // DELETE /:id/days/:dayId/services/:serviceId — Delete service
  .delete("/:id/days/:dayId/services/:serviceId", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.deleteDayService(
      c.get("db"),
      productId,
      c.req.param("serviceId"),
    )

    if (!row) {
      return c.json({ error: "Service not found" }, 404)
    }

    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "day" })
    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Versions
  // ==========================================================================

  // GET /:id/versions — List versions for product
  .get("/:id/versions", async (c) => {
    return c.json({ data: await productsService.listVersions(c.get("db"), c.req.param("id")) })
  })

  // POST /:id/versions — Create version snapshot
  .post("/:id/versions", async (c) => {
    const userId = requireUserId(c)
    const row = await productsService.createVersion(
      c.get("db"),
      c.req.param("id"),
      userId,
      await parseJsonBody(c, insertVersionSchema, {
        invalidJsonMessage: "Invalid JSON body",
      }).catch((error) => {
        if (error instanceof RequestValidationError && error.message === "Invalid JSON body") {
          return {}
        }

        throw error
      }),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // ==========================================================================
  // Notes
  // ==========================================================================

  // GET /:id/notes — List notes for product
  .get("/:id/notes", async (c) => {
    return c.json({ data: await productsService.listNotes(c.get("db"), c.req.param("id")) })
  })

  // POST /:id/notes — Add note to product
  .post("/:id/notes", async (c) => {
    const userId = requireUserId(c)
    const row = await productsService.createNote(
      c.get("db"),
      c.req.param("id"),
      userId,
      await parseJsonBody(c, insertProductNoteSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

  // ==========================================================================
  // Product <-> Category associations
  // ==========================================================================

  .get("/:id/categories", async (c) => {
    return c.json({
      data: await productsService.listProductCategories_(c.get("db"), c.req.param("id")),
    })
  })

  .post("/:id/categories", async (c) => {
    const productId = c.req.param("id")
    const { categoryId, sortOrder } = await parseJsonBody(
      c,
      z.object({
        categoryId: z.string(),
        sortOrder: z.number().optional(),
      }),
    )
    const row = await productsService.addProductToCategory(
      c.get("db"),
      productId,
      categoryId,
      sortOrder,
    )
    if (!row) {
      return c.json({ error: "Already assigned or not found" }, 409)
    }
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "category" })
    return c.json({ success: true }, 201)
  })

  .delete("/:id/categories/:categoryId", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.removeProductFromCategory(
      c.get("db"),
      productId,
      c.req.param("categoryId"),
    )
    if (!row) {
      return c.json({ error: "Association not found" }, 404)
    }
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "category" })
    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Product <-> Tag associations
  // ==========================================================================

  .get("/:id/tags", async (c) => {
    return c.json({
      data: await productsService.listProductTags_(c.get("db"), c.req.param("id")),
    })
  })

  .post("/:id/tags", async (c) => {
    const productId = c.req.param("id")
    const { tagId } = await parseJsonBody(
      c,
      z.object({
        tagId: z.string(),
      }),
    )
    const row = await productsService.addProductTag(c.get("db"), productId, tagId)
    if (!row) {
      return c.json({ error: "Already assigned or not found" }, 409)
    }
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "tag" })
    return c.json({ success: true }, 201)
  })

  .delete("/:id/tags/:tagId", async (c) => {
    const productId = c.req.param("id")
    const row = await productsService.removeProductTag(c.get("db"), productId, c.req.param("tagId"))
    if (!row) {
      return c.json({ error: "Association not found" }, 404)
    }
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "tag" })
    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Product Media (nested under product)
  // ==========================================================================

  // GET /:id/media — List product-level media
  .get("/:id/media", async (c) => {
    const query = parseQuery(c, productMediaListQuerySchema)
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
      await parseJsonBody(c, insertProductMediaSchema),
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
    const data = await parseJsonBody(c, reorderProductMediaSchema)
    const results = await productsService.reorderMedia(c.get("db"), data)
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "media" })
    return c.json({ data: results })
  })

  // GET /:id/days/:dayId/media — List day media
  .get("/:id/days/:dayId/media", async (c) => {
    const query = parseQuery(c, productMediaListQuerySchema)
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
    const body = await parseJsonBody(c, insertProductMediaSchema)
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

  // ==========================================================================
  // Recalculate
  // ==========================================================================

  // POST /:id/recalculate — Recalculate product cost and margin
  .post("/:id/recalculate", async (c) => {
    const result = await productsService.recalculate(c.get("db"), c.req.param("id"))

    if (!result) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: result })
  })

export type ProductRoutes = typeof productRoutes

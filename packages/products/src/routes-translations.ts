import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import { Hono } from "hono"
import { appendProductMutationLedgerEntry, changedMutationFields } from "./action-ledger.js"
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
    const body = await parseJsonBody(c, validation.insertProductTranslationSchema)
    const row = await productsService.createProductTranslation(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product translation",
      actionName: "product.translation.create",
      routeOrToolName: "products.translation.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "translation" })
    return c.json({ data: row }, 201)
  })

  .patch("/translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const body = await parseJsonBody(c, validation.updateProductTranslationSchema)
    const before = await productsService.getProductTranslationById(c.get("db"), translationId)
    if (!before) {
      return c.json({ error: "Product translation not found" }, 404)
    }

    const row = await productsService.updateProductTranslation(c.get("db"), translationId, body)

    if (!row) {
      return c.json({ error: "Product translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product translation",
      actionName: "product.translation.update",
      routeOrToolName: "products.translation.update",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: row.productId,
      axis: "translation",
    })
    return c.json({ data: row })
  })

  .delete("/translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const before = await productsService.getProductTranslationById(c.get("db"), translationId)
    if (!before) {
      return c.json({ error: "Product translation not found" }, 404)
    }

    const row = await productsService.deleteProductTranslation(c.get("db"), translationId)

    if (!row) {
      return c.json({ error: "Product translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product translation",
      actionName: "product.translation.delete",
      routeOrToolName: "products.translation.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
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
    const optionId = c.req.param("optionId")
    const body = await parseJsonBody(c, validation.insertProductOptionTranslationSchema)
    const option = await productsService.getOptionById(c.get("db"), optionId)
    if (!option) {
      return c.json({ error: "Product option not found" }, 404)
    }

    const row = await productsService.createOptionTranslation(c.get("db"), optionId, body)

    if (!row) {
      return c.json({ error: "Product option not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId: option.productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product option translation",
      actionName: "product.option_translation.create",
      routeOrToolName: "products.option_translation.create",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: option.productId,
      axis: "translation",
    })
    return c.json({ data: row }, 201)
  })

  .patch("/option-translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const body = await parseJsonBody(c, validation.updateProductOptionTranslationSchema)
    const before = await productsService.getOptionTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before) {
      return c.json({ error: "Option translation not found" }, 404)
    }

    const row = await productsService.updateOptionTranslation(c.get("db"), translationId, body)

    if (!row) {
      return c.json({ error: "Option translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: before.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product option translation",
      actionName: "product.option_translation.update",
      routeOrToolName: "products.option_translation.update",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
    return c.json({ data: row })
  })

  .delete("/option-translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const before = await productsService.getOptionTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before) {
      return c.json({ error: "Option translation not found" }, 404)
    }

    const row = await productsService.deleteOptionTranslation(c.get("db"), translationId)

    if (!row) {
      return c.json({ error: "Option translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product option translation",
      actionName: "product.option_translation.delete",
      routeOrToolName: "products.option_translation.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
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
    const unitId = c.req.param("unitId")
    const body = await parseJsonBody(c, validation.insertOptionUnitTranslationSchema)
    const unit = await productsService.getUnitForProductMutation(c.get("db"), unitId)
    if (!unit) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    const row = await productsService.createUnitTranslation(c.get("db"), unitId, body)

    if (!row) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId: unit.productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product option unit translation",
      actionName: "product.option_unit_translation.create",
      routeOrToolName: "products.option_unit_translation.create",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: unit.productId,
      axis: "translation",
    })
    return c.json({ data: row }, 201)
  })

  .patch("/unit-translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const body = await parseJsonBody(c, validation.updateOptionUnitTranslationSchema)
    const before = await productsService.getUnitTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before) {
      return c.json({ error: "Unit translation not found" }, 404)
    }

    const row = await productsService.updateUnitTranslation(c.get("db"), translationId, body)

    if (!row) {
      return c.json({ error: "Unit translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: before.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product option unit translation",
      actionName: "product.option_unit_translation.update",
      routeOrToolName: "products.option_unit_translation.update",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
    return c.json({ data: row })
  })

  .delete("/unit-translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const before = await productsService.getUnitTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before) {
      return c.json({ error: "Unit translation not found" }, 404)
    }

    const row = await productsService.deleteUnitTranslation(c.get("db"), translationId)

    if (!row) {
      return c.json({ error: "Unit translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product option unit translation",
      actionName: "product.option_unit_translation.delete",
      routeOrToolName: "products.option_unit_translation.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
    return c.json({ success: true }, 200)
  })

  .get("/itinerary-translations", async (c) => {
    const query = parseQuery(c, validation.itineraryTranslationListQuerySchema)
    return c.json(await productsService.listItineraryTranslations(c.get("db"), query))
  })

  .get("/itinerary-translations/:translationId", async (c) => {
    const row = await productsService.getItineraryTranslationById(
      c.get("db"),
      c.req.param("translationId"),
    )

    if (!row) {
      return c.json({ error: "Itinerary translation not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/itineraries/:itineraryId/translations", async (c) => {
    const itineraryId = c.req.param("itineraryId")
    const body = await parseJsonBody(c, validation.insertItineraryTranslationSchema)
    const itinerary = await productsService.getItineraryById(c.get("db"), itineraryId)
    if (!itinerary) {
      return c.json({ error: "Product itinerary not found" }, 404)
    }

    const row = await productsService.createItineraryTranslation(c.get("db"), itineraryId, body)

    if (!row) {
      return c.json({ error: "Product itinerary not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId: itinerary.productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product itinerary translation",
      actionName: "product.itinerary_translation.create",
      routeOrToolName: "products.itinerary_translation.create",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: itinerary.productId,
      axis: "translation",
    })
    return c.json({ data: row }, 201)
  })

  .patch("/itinerary-translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const body = await parseJsonBody(c, validation.updateItineraryTranslationSchema)
    const before = await productsService.getItineraryTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before) {
      return c.json({ error: "Itinerary translation not found" }, 404)
    }

    const row = await productsService.updateItineraryTranslation(c.get("db"), translationId, body)

    if (!row) {
      return c.json({ error: "Itinerary translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: before.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product itinerary translation",
      actionName: "product.itinerary_translation.update",
      routeOrToolName: "products.itinerary_translation.update",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
    return c.json({ data: row })
  })

  .delete("/itinerary-translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const before = await productsService.getItineraryTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before) {
      return c.json({ error: "Itinerary translation not found" }, 404)
    }

    const row = await productsService.deleteItineraryTranslation(c.get("db"), translationId)

    if (!row) {
      return c.json({ error: "Itinerary translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product itinerary translation",
      actionName: "product.itinerary_translation.delete",
      routeOrToolName: "products.itinerary_translation.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
    return c.json({ success: true }, 200)
  })

  .get("/day-translations", async (c) => {
    const query = parseQuery(c, validation.dayTranslationListQuerySchema)
    return c.json(await productsService.listDayTranslations(c.get("db"), query))
  })

  .get("/day-translations/:translationId", async (c) => {
    const row = await productsService.getDayTranslationById(
      c.get("db"),
      c.req.param("translationId"),
    )

    if (!row) {
      return c.json({ error: "Day translation not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/days/:dayId/translations", async (c) => {
    const dayId = c.req.param("dayId")
    const body = await parseJsonBody(c, validation.insertDayTranslationSchema)
    const day = await productsService.getDayForProductMutation(c.get("db"), dayId)
    if (!day) {
      return c.json({ error: "Product day not found" }, 404)
    }

    const row = await productsService.createDayTranslation(c.get("db"), dayId, body)

    if (!row) {
      return c.json({ error: "Product day not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId: day.productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product day translation",
      actionName: "product.day_translation.create",
      routeOrToolName: "products.day_translation.create",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: day.productId,
      axis: "translation",
    })
    return c.json({ data: row }, 201)
  })

  .patch("/day-translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const body = await parseJsonBody(c, validation.updateDayTranslationSchema)
    const before = await productsService.getDayTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before) {
      return c.json({ error: "Day translation not found" }, 404)
    }

    const row = await productsService.updateDayTranslation(c.get("db"), translationId, body)

    if (!row) {
      return c.json({ error: "Day translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: before.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product day translation",
      actionName: "product.day_translation.update",
      routeOrToolName: "products.day_translation.update",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
    return c.json({ data: row })
  })

  .delete("/day-translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const before = await productsService.getDayTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before) {
      return c.json({ error: "Day translation not found" }, 404)
    }

    const row = await productsService.deleteDayTranslation(c.get("db"), translationId)

    if (!row) {
      return c.json({ error: "Day translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product day translation",
      actionName: "product.day_translation.delete",
      routeOrToolName: "products.day_translation.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
    return c.json({ success: true }, 200)
  })

  .get("/day-service-translations", async (c) => {
    const query = parseQuery(c, validation.dayServiceTranslationListQuerySchema)
    return c.json(await productsService.listDayServiceTranslations(c.get("db"), query))
  })

  .get("/day-service-translations/:translationId", async (c) => {
    const row = await productsService.getDayServiceTranslationById(
      c.get("db"),
      c.req.param("translationId"),
    )

    if (!row) {
      return c.json({ error: "Day service translation not found" }, 404)
    }

    return c.json({ data: row })
  })

  .post("/day-services/:serviceId/translations", async (c) => {
    const serviceId = c.req.param("serviceId")
    const body = await parseJsonBody(c, validation.insertDayServiceTranslationSchema)
    const service = await productsService.getDayServiceForProductMutation(c.get("db"), serviceId)
    if (!service) {
      return c.json({ error: "Product day service not found" }, 404)
    }

    const row = await productsService.createDayServiceTranslation(c.get("db"), serviceId, body)

    if (!row) {
      return c.json({ error: "Product day service not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId: service.productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product day service translation",
      actionName: "product.day_service_translation.create",
      routeOrToolName: "products.day_service_translation.create",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: service.productId,
      axis: "translation",
    })
    return c.json({ data: row }, 201)
  })

  .patch("/day-service-translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const body = await parseJsonBody(c, validation.updateDayServiceTranslationSchema)
    const before = await productsService.getDayServiceTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before) {
      return c.json({ error: "Day service translation not found" }, 404)
    }

    const row = await productsService.updateDayServiceTranslation(c.get("db"), translationId, body)

    if (!row) {
      return c.json({ error: "Day service translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: before.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product day service translation",
      actionName: "product.day_service_translation.update",
      routeOrToolName: "products.day_service_translation.update",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
    return c.json({ data: row })
  })

  .delete("/day-service-translations/:translationId", async (c) => {
    const translationId = c.req.param("translationId")
    const before = await productsService.getDayServiceTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before) {
      return c.json({ error: "Day service translation not found" }, 404)
    }

    const row = await productsService.deleteDayServiceTranslation(c.get("db"), translationId)

    if (!row) {
      return c.json({ error: "Day service translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product day service translation",
      actionName: "product.day_service_translation.delete",
      routeOrToolName: "products.day_service_translation.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: before.productId,
      axis: "translation",
    })
    return c.json({ success: true }, 200)
  })

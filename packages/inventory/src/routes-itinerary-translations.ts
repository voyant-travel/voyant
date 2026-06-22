import { parseJsonBody } from "@voyant-travel/hono"
import { Hono } from "hono"

import { appendProductMutationLedgerEntry, changedMutationFields } from "./action-ledger.js"
import { emitProductContentChanged } from "./events.js"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"
import * as validation from "./validation.js"

export const productItineraryTranslationRoutes = new Hono<Env>()
  // ==========================================================================
  // Itinerary translations
  // ==========================================================================

  .get("/:id/itineraries/:itineraryId/translations", async (c) => {
    return c.json(
      await productsService.listProductItineraryTranslations(c.get("db"), {
        itineraryId: c.req.param("itineraryId"),
        limit: 100,
        offset: 0,
      }),
    )
  })

  .post("/:id/itineraries/:itineraryId/translations", async (c) => {
    const productId = c.req.param("id")
    const itineraryId = c.req.param("itineraryId")
    const body = await parseJsonBody(c, validation.insertProductItineraryTranslationSchema)
    const row = await productsService.createProductItineraryTranslation(
      c.get("db"),
      productId,
      itineraryId,
      body,
    )

    if (!row) {
      return c.json({ error: "Itinerary not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product itinerary translation",
      actionName: "product.itinerary_translation.create",
      routeOrToolName: "products.itinerary_translation.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "itinerary" })
    return c.json({ data: row }, 201)
  })

  .patch("/:id/itineraries/:itineraryId/translations/:translationId", async (c) => {
    const productId = c.req.param("id")
    const itineraryId = c.req.param("itineraryId")
    const translationId = c.req.param("translationId")
    const before = await productsService.getItineraryTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before || before.productId !== productId || before.itineraryId !== itineraryId) {
      return c.json({ error: "Itinerary translation not found" }, 404)
    }

    const body = await parseJsonBody(c, validation.updateProductItineraryTranslationSchema)
    const row = await productsService.updateProductItineraryTranslation(
      c.get("db"),
      translationId,
      body,
    )

    if (!row) {
      return c.json({ error: "Itinerary translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product itinerary translation",
      actionName: "product.itinerary_translation.update",
      routeOrToolName: "products.itinerary_translation.update",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "itinerary" })
    return c.json({ data: row })
  })

  .delete("/:id/itineraries/:itineraryId/translations/:translationId", async (c) => {
    const productId = c.req.param("id")
    const itineraryId = c.req.param("itineraryId")
    const translationId = c.req.param("translationId")
    const before = await productsService.getItineraryTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before || before.productId !== productId || before.itineraryId !== itineraryId) {
      return c.json({ error: "Itinerary translation not found" }, 404)
    }

    const row = await productsService.deleteProductItineraryTranslation(c.get("db"), translationId)

    if (!row) {
      return c.json({ error: "Itinerary translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId,
      changedFields: [],
      subject: "product itinerary translation",
      actionName: "product.itinerary_translation.delete",
      routeOrToolName: "products.itinerary_translation.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "itinerary" })
    return c.json({ success: true }, 200)
  })

  // ==========================================================================
  // Day service translations
  // ==========================================================================

  .get("/:id/days/:dayId/services/:serviceId/translations", async (c) => {
    return c.json(
      await productsService.listDayServiceTranslations(c.get("db"), {
        serviceId: c.req.param("serviceId"),
        limit: 100,
        offset: 0,
      }),
    )
  })

  .post("/:id/days/:dayId/services/:serviceId/translations", async (c) => {
    const productId = c.req.param("id")
    const dayId = c.req.param("dayId")
    const serviceId = c.req.param("serviceId")
    const body = await parseJsonBody(c, validation.insertDayServiceTranslationSchema)
    const row = await productsService.createDayServiceTranslation(
      c.get("db"),
      productId,
      dayId,
      serviceId,
      body,
    )

    if (!row) {
      return c.json({ error: "Service not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product day service translation",
      actionName: "product.day_service_translation.create",
      routeOrToolName: "products.day_service_translation.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "day" })
    return c.json({ data: row }, 201)
  })

  .patch("/:id/days/:dayId/services/:serviceId/translations/:translationId", async (c) => {
    const productId = c.req.param("id")
    const dayId = c.req.param("dayId")
    const serviceId = c.req.param("serviceId")
    const translationId = c.req.param("translationId")
    const before = await productsService.getDayServiceTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (
      !before ||
      before.productId !== productId ||
      before.dayId !== dayId ||
      before.serviceId !== serviceId
    ) {
      return c.json({ error: "Service translation not found" }, 404)
    }

    const body = await parseJsonBody(c, validation.updateDayServiceTranslationSchema)
    const row = await productsService.updateDayServiceTranslation(c.get("db"), translationId, body)

    if (!row) {
      return c.json({ error: "Service translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product day service translation",
      actionName: "product.day_service_translation.update",
      routeOrToolName: "products.day_service_translation.update",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "day" })
    return c.json({ data: row })
  })

  .delete("/:id/days/:dayId/services/:serviceId/translations/:translationId", async (c) => {
    const productId = c.req.param("id")
    const dayId = c.req.param("dayId")
    const serviceId = c.req.param("serviceId")
    const translationId = c.req.param("translationId")
    const before = await productsService.getDayServiceTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (
      !before ||
      before.productId !== productId ||
      before.dayId !== dayId ||
      before.serviceId !== serviceId
    ) {
      return c.json({ error: "Service translation not found" }, 404)
    }

    const row = await productsService.deleteDayServiceTranslation(c.get("db"), translationId)

    if (!row) {
      return c.json({ error: "Service translation not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId,
      changedFields: [],
      subject: "product day service translation",
      actionName: "product.day_service_translation.delete",
      routeOrToolName: "products.day_service_translation.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "day" })
    return c.json({ success: true }, 200)
  })

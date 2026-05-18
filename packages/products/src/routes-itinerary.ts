import { parseJsonBody, RequestValidationError, requireUserId } from "@voyantjs/hono"
import { Hono } from "hono"
import { appendProductMutationLedgerEntry, changedMutationFields } from "./action-ledger.js"
import { emitProductContentChanged } from "./events.js"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"
import * as validation from "./validation.js"

export const productItineraryRoutes = new Hono<Env>()
  // ==========================================================================
  // Itineraries
  // ==========================================================================

  .get("/:id/itineraries", async (c) => {
    return c.json({ data: await productsService.listItineraries(c.get("db"), c.req.param("id")) })
  })

  .post("/:id/itineraries", async (c) => {
    const productId = c.req.param("id")
    const body = await parseJsonBody(c, validation.insertItinerarySchema)
    const row = await productsService.createItinerary(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product itinerary",
      actionName: "product.itinerary.create",
      routeOrToolName: "products.itinerary.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "itinerary" })
    return c.json({ data: row }, 201)
  })

  .patch("/itineraries/:itineraryId", async (c) => {
    const itineraryId = c.req.param("itineraryId")
    const body = await parseJsonBody(c, validation.updateItinerarySchema)
    const before = await productsService.getItineraryById(c.get("db"), itineraryId)
    if (!before) {
      return c.json({ error: "Itinerary not found" }, 404)
    }

    const row = await productsService.updateItinerary(c.get("db"), itineraryId, body)

    if (!row) {
      return c.json({ error: "Itinerary not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product itinerary",
      actionName: "product.itinerary.update",
      routeOrToolName: "products.itinerary.update",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "itinerary" })
    return c.json({ data: row })
  })

  .delete("/itineraries/:itineraryId", async (c) => {
    const itineraryId = c.req.param("itineraryId")
    const before = await productsService.getItineraryById(c.get("db"), itineraryId)
    if (!before) {
      return c.json({ error: "Itinerary not found" }, 404)
    }

    const row = await productsService.deleteItinerary(c.get("db"), itineraryId)

    if (!row) {
      return c.json({ error: "Itinerary not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product itinerary",
      actionName: "product.itinerary.delete",
      routeOrToolName: "products.itinerary.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "itinerary" })
    return c.json({ success: true }, 200)
  })

  .post("/itineraries/:itineraryId/duplicate", async (c) => {
    const itineraryId = c.req.param("itineraryId")
    const body = await parseJsonBody(c, validation.duplicateItinerarySchema)
    const source = await productsService.getItineraryById(c.get("db"), itineraryId)
    if (!source) {
      return c.json({ error: "Itinerary not found" }, 404)
    }

    const row = await productsService.duplicateItinerary(c.get("db"), itineraryId, body)

    if (!row) {
      return c.json({ error: "Itinerary not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "duplicate",
      productId: source.productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product itinerary",
      actionName: "product.itinerary.duplicate",
      routeOrToolName: "products.itinerary.duplicate",
    })
    await emitProductContentChanged(c.get("eventBus"), {
      id: source.productId,
      axis: "itinerary",
    })
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
    const productId = c.req.param("id")
    const body = await parseJsonBody(c, validation.insertDaySchema)
    const row = await productsService.createItineraryDay(
      c.get("db"),
      productId,
      c.req.param("itineraryId"),
      body,
    )

    if (!row) {
      return c.json({ error: "Itinerary not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product itinerary day",
      actionName: "product.day.create",
      routeOrToolName: "products.day.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "day" })
    return c.json({ data: row }, 201)
  })

  // GET /:id/days — List days for product
  .get("/:id/days", async (c) => {
    return c.json({ data: await productsService.listDays(c.get("db"), c.req.param("id")) })
  })

  // POST /:id/days — Add day to product
  .post("/:id/days", async (c) => {
    const productId = c.req.param("id")
    const body = await parseJsonBody(c, validation.insertDaySchema)
    const row = await productsService.createDay(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product itinerary day",
      actionName: "product.day.create",
      routeOrToolName: "products.day.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "day" })
    return c.json({ data: row }, 201)
  })

  // PATCH /:id/days/:dayId — Update day
  .patch("/:id/days/:dayId", async (c) => {
    const productId = c.req.param("id")
    const dayId = c.req.param("dayId")
    const body = await parseJsonBody(c, validation.updateDaySchema)
    const before = await productsService.getDayForProductMutation(c.get("db"), dayId)
    if (!before || before.productId !== productId) {
      return c.json({ error: "Day not found" }, 404)
    }

    const row = await productsService.updateDay(c.get("db"), dayId, body)

    if (!row) {
      return c.json({ error: "Day not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: before.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product itinerary day",
      actionName: "product.day.update",
      routeOrToolName: "products.day.update",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "day" })
    return c.json({ data: row })
  })

  // DELETE /:id/days/:dayId — Delete day
  .delete("/:id/days/:dayId", async (c) => {
    const productId = c.req.param("id")
    const dayId = c.req.param("dayId")
    const before = await productsService.getDayForProductMutation(c.get("db"), dayId)
    if (!before || before.productId !== productId) {
      return c.json({ error: "Day not found" }, 404)
    }

    const row = await productsService.deleteDay(c.get("db"), dayId)

    if (!row) {
      return c.json({ error: "Day not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product itinerary day",
      actionName: "product.day.delete",
      routeOrToolName: "products.day.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "day" })
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
    const body = await parseJsonBody(c, validation.insertDayServiceSchema)
    const row = await productsService.createDayService(
      c.get("db"),
      productId,
      c.req.param("dayId"),
      body,
    )

    if (!row) {
      return c.json({ error: "Day not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product day service",
      actionName: "product.day_service.create",
      routeOrToolName: "products.day_service.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "day" })
    return c.json({ data: row }, 201)
  })

  // PATCH /:id/days/:dayId/services/:serviceId — Update service
  .patch("/:id/days/:dayId/services/:serviceId", async (c) => {
    const productId = c.req.param("id")
    const serviceId = c.req.param("serviceId")
    const body = await parseJsonBody(c, validation.updateDayServiceSchema)
    const before = await productsService.getDayServiceForProductMutation(c.get("db"), serviceId)
    if (!before || before.productId !== productId) {
      return c.json({ error: "Service not found" }, 404)
    }

    const row = await productsService.updateDayService(c.get("db"), productId, serviceId, body)

    if (!row) {
      return c.json({ error: "Service not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: before.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product day service",
      actionName: "product.day_service.update",
      routeOrToolName: "products.day_service.update",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "day" })
    return c.json({ data: row })
  })

  // DELETE /:id/days/:dayId/services/:serviceId — Delete service
  .delete("/:id/days/:dayId/services/:serviceId", async (c) => {
    const productId = c.req.param("id")
    const serviceId = c.req.param("serviceId")
    const before = await productsService.getDayServiceForProductMutation(c.get("db"), serviceId)
    if (!before || before.productId !== productId) {
      return c.json({ error: "Service not found" }, 404)
    }

    const row = await productsService.deleteDayService(c.get("db"), productId, serviceId)

    if (!row) {
      return c.json({ error: "Service not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product day service",
      actionName: "product.day_service.delete",
      routeOrToolName: "products.day_service.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "day" })
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
      await parseJsonBody(c, validation.insertVersionSchema, {
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
      await parseJsonBody(c, validation.insertProductNoteSchema),
    )

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })

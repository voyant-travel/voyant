import { parseJsonBody, RequestValidationError, requireUserId } from "@voyantjs/hono"
import { Hono } from "hono"
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
    const row = await productsService.createItinerary(
      c.get("db"),
      c.req.param("id"),
      await parseJsonBody(c, validation.insertItinerarySchema),
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
      await parseJsonBody(c, validation.updateItinerarySchema),
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
    const body = await parseJsonBody(c, validation.duplicateItinerarySchema)
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
      await parseJsonBody(c, validation.insertDaySchema),
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
      await parseJsonBody(c, validation.insertDaySchema),
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
      await parseJsonBody(c, validation.updateDaySchema),
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
      await parseJsonBody(c, validation.insertDayServiceSchema),
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
      await parseJsonBody(c, validation.updateDayServiceSchema),
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

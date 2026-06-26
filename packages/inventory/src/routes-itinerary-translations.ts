/**
 * Admin product itinerary-translation routes — itinerary translations and day
 * service translations. Mounted by the operator starter under
 * `/v1/admin/products/...` on the (already `OpenAPIHono`) parent `productRoutes`
 * (staff-actor gated by the parent app's middleware chain).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * inventory itinerary sub-batch). Request schemas reuse the existing
 * `@voyant-travel/products-contracts` validation schemas the handlers already
 * parse; response row schemas are authored from the Drizzle `$inferSelect`
 * shapes in `schema-itinerary.ts` (§17: `Date`/timestamp columns serialize to
 * strings over the wire). Both list legs return the paginated `listResponse`
 * envelope. Business logic, auth, action-ledger writes, and content-changed
 * events are unchanged; handlers read `c.req.valid(...)`.
 *
 * Each resource is its own child `OpenAPIHono` sub-chain mounted via
 * `.route("/", child)` so the parent stays shallow (avoids the O(n²) tsc blowup
 * of one long flat `.openapi(...)` chain).
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"

import { appendProductMutationLedgerEntry, changedMutationFields } from "./action-ledger.js"
import { emitProductContentChanged } from "./events.js"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"
import * as validation from "./validation.js"

const errorResponseSchema = z.object({ error: z.string() })
const successSchema = z.object({ success: z.boolean() })

const productItineraryParamSchema = z.object({ id: z.string(), itineraryId: z.string() })
const itineraryTranslationParamSchema = z.object({
  id: z.string(),
  itineraryId: z.string(),
  translationId: z.string(),
})
const productServiceParamSchema = z.object({
  id: z.string(),
  dayId: z.string(),
  serviceId: z.string(),
})
const dayServiceTranslationParamSchema = z.object({
  id: z.string(),
  dayId: z.string(),
  serviceId: z.string(),
  translationId: z.string(),
})

/** §17: timestamp columns are ISO strings over the wire. */
const isoTimestamp = z.string()

// --- Response row schemas (authored from the Drizzle `$inferSelect` shapes) ---

const itineraryTranslationSchema = z.object({
  id: z.string(),
  itineraryId: z.string(),
  languageTag: z.string(),
  name: z.string(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const dayServiceTranslationSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  languageTag: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// ==========================================================================
// Itinerary translations
// ==========================================================================

const listItineraryTranslationsRoute = createRoute({
  method: "get",
  path: "/{id}/itineraries/{itineraryId}/translations",
  request: { params: productItineraryParamSchema },
  responses: {
    200: {
      description: "Paginated list of itinerary translations",
      content: { "application/json": { schema: listResponseSchema(itineraryTranslationSchema) } },
    },
  },
})

const createItineraryTranslationRoute = createRoute({
  method: "post",
  path: "/{id}/itineraries/{itineraryId}/translations",
  request: {
    params: productItineraryParamSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: validation.insertProductItineraryTranslationSchema },
      },
    },
  },
  responses: {
    201: {
      description: "The created itinerary translation",
      content: { "application/json": { schema: z.object({ data: itineraryTranslationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Itinerary not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateItineraryTranslationRoute = createRoute({
  method: "patch",
  path: "/{id}/itineraries/{itineraryId}/translations/{translationId}",
  request: {
    params: itineraryTranslationParamSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: validation.updateProductItineraryTranslationSchema },
      },
    },
  },
  responses: {
    200: {
      description: "The updated itinerary translation",
      content: { "application/json": { schema: z.object({ data: itineraryTranslationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Itinerary translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteItineraryTranslationRoute = createRoute({
  method: "delete",
  path: "/{id}/itineraries/{itineraryId}/translations/{translationId}",
  request: { params: itineraryTranslationParamSchema },
  responses: {
    200: {
      description: "Itinerary translation deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Itinerary translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const itineraryTranslationRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listItineraryTranslationsRoute, async (c) =>
    c.json(
      await productsService.listProductItineraryTranslations(c.get("db"), {
        itineraryId: c.req.valid("param").itineraryId,
        limit: 100,
        offset: 0,
      }),
      200,
    ),
  )
  .openapi(createItineraryTranslationRoute, async (c) => {
    const { id: productId, itineraryId } = c.req.valid("param")
    const body = c.req.valid("json")
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
  .openapi(updateItineraryTranslationRoute, async (c) => {
    const { id: productId, itineraryId, translationId } = c.req.valid("param")
    const before = await productsService.getItineraryTranslationForProductMutation(
      c.get("db"),
      translationId,
    )
    if (!before || before.productId !== productId || before.itineraryId !== itineraryId) {
      return c.json({ error: "Itinerary translation not found" }, 404)
    }

    const body = c.req.valid("json")
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
    return c.json({ data: row }, 200)
  })
  .openapi(deleteItineraryTranslationRoute, async (c) => {
    const { id: productId, itineraryId, translationId } = c.req.valid("param")
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

const listDayServiceTranslationsRoute = createRoute({
  method: "get",
  path: "/{id}/days/{dayId}/services/{serviceId}/translations",
  request: { params: productServiceParamSchema },
  responses: {
    200: {
      description: "Paginated list of day service translations",
      content: { "application/json": { schema: listResponseSchema(dayServiceTranslationSchema) } },
    },
  },
})

const createDayServiceTranslationRoute = createRoute({
  method: "post",
  path: "/{id}/days/{dayId}/services/{serviceId}/translations",
  request: {
    params: productServiceParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertDayServiceTranslationSchema } },
    },
  },
  responses: {
    201: {
      description: "The created day service translation",
      content: { "application/json": { schema: z.object({ data: dayServiceTranslationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Service not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateDayServiceTranslationRoute = createRoute({
  method: "patch",
  path: "/{id}/days/{dayId}/services/{serviceId}/translations/{translationId}",
  request: {
    params: dayServiceTranslationParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateDayServiceTranslationSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated day service translation",
      content: { "application/json": { schema: z.object({ data: dayServiceTranslationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Service translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteDayServiceTranslationRoute = createRoute({
  method: "delete",
  path: "/{id}/days/{dayId}/services/{serviceId}/translations/{translationId}",
  request: { params: dayServiceTranslationParamSchema },
  responses: {
    200: {
      description: "Service translation deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Service translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const dayServiceTranslationRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listDayServiceTranslationsRoute, async (c) =>
    c.json(
      await productsService.listDayServiceTranslations(c.get("db"), {
        serviceId: c.req.valid("param").serviceId,
        limit: 100,
        offset: 0,
      }),
      200,
    ),
  )
  .openapi(createDayServiceTranslationRoute, async (c) => {
    const { id: productId, dayId, serviceId } = c.req.valid("param")
    const body = c.req.valid("json")
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
  .openapi(updateDayServiceTranslationRoute, async (c) => {
    const { id: productId, dayId, serviceId, translationId } = c.req.valid("param")
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

    const body = c.req.valid("json")
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
    return c.json({ data: row }, 200)
  })
  .openapi(deleteDayServiceTranslationRoute, async (c) => {
    const { id: productId, dayId, serviceId, translationId } = c.req.valid("param")
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

// Mount each per-resource child sub-chain on the itinerary-translation parent.
export const productItineraryTranslationRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})
  .route("/", itineraryTranslationRoutes)
  .route("/", dayServiceTranslationRoutes)

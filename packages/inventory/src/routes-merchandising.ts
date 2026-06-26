/**
 * Admin product merchandising routes — features, FAQs, locations, destinations,
 * destination/category/tag translations, and product↔destination links. Mounted
 * by the operator starter under `/v1/admin/products/...` on the (already
 * `OpenAPIHono`) parent `productRoutes` (staff-actor gated by the parent app's
 * middleware chain).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * inventory merchandising sub-batch). Request schemas reuse the existing
 * `@voyant-travel/products-contracts` validation schemas the handlers already
 * parse; response row schemas are authored from the Drizzle `$inferSelect`
 * shapes in `schema-settings.ts` / `schema-taxonomy.ts` (§17: `Date`/timestamp
 * columns serialize to strings over the wire; integer/double fields stay
 * numbers). The `/destination-links` list joins `destinations`, so its row
 * schema extends the base `product_destinations` shape with the joined columns.
 * Business logic, auth, action-ledger writes, and content-changed events are
 * unchanged; handlers read `c.req.valid(...)`.
 *
 * Each resource is its own child `OpenAPIHono` sub-chain mounted via
 * `.route("/", child)` so the parent stays shallow (avoids the O(n²) tsc blowup
 * of one long flat `.openapi(...)` chain). Within each child, the static
 * collection paths are registered before the dynamic `/{id}` legs; the
 * static-first destination resource is mounted before the dynamic
 * `/{id}/destinations` link resource.
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
const idParamSchema = z.object({ id: z.string() })
const successSchema = z.object({ success: z.boolean() })

/** §17: timestamp columns are ISO strings over the wire. */
const isoTimestamp = z.string()

const featureTypeValues = [
  "inclusion",
  "exclusion",
  "highlight",
  "important_information",
  "other",
] as const

const locationTypeValues = [
  "start",
  "end",
  "meeting_point",
  "pickup",
  "dropoff",
  "point_of_interest",
  "other",
] as const

// --- Response row schemas (authored from the Drizzle `$inferSelect` shapes) ---

const featureSchema = z.object({
  id: z.string(),
  productId: z.string(),
  featureType: z.enum(featureTypeValues),
  title: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const faqSchema = z.object({
  id: z.string(),
  productId: z.string(),
  question: z.string(),
  answer: z.string(),
  sortOrder: z.number(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const locationSchema = z.object({
  id: z.string(),
  productId: z.string(),
  locationType: z.enum(locationTypeValues),
  title: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  countryCode: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  googlePlaceId: z.string().nullable(),
  applePlaceId: z.string().nullable(),
  tripadvisorLocationId: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const destinationSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  slug: z.string(),
  code: z.string().nullable(),
  canonicalPlaceId: z.string().nullable(),
  destinationType: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  sortOrder: z.number(),
  active: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const destinationTranslationSchema = z.object({
  id: z.string(),
  destinationId: z.string(),
  languageTag: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const productCategoryTranslationSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  languageTag: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const productTagTranslationSchema = z.object({
  id: z.string(),
  tagId: z.string(),
  languageTag: z.string(),
  name: z.string(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/** Base `product_destinations` $inferSelect (composite PK — no `id`). */
const productDestinationSchema = z.object({
  productId: z.string(),
  destinationId: z.string(),
  sortOrder: z.number(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/** List rows join `destinations` for the three trailing columns. */
const productDestinationListItemSchema = productDestinationSchema.extend({
  destinationSlug: z.string(),
  destinationType: z.string(),
  destinationActive: z.boolean(),
})

// ==========================================================================
// Features
// ==========================================================================

const listFeaturesRoute = createRoute({
  method: "get",
  path: "/features",
  request: { query: validation.productFeatureListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of product features",
      content: { "application/json": { schema: listResponseSchema(featureSchema) } },
    },
  },
})

const getFeatureRoute = createRoute({
  method: "get",
  path: "/features/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A product feature by id",
      content: { "application/json": { schema: z.object({ data: featureSchema }) } },
    },
    404: {
      description: "Product feature not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const createFeatureRoute = createRoute({
  method: "post",
  path: "/{id}/features",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertProductFeatureSchema } },
    },
  },
  responses: {
    201: {
      description: "The created feature for the product",
      content: { "application/json": { schema: z.object({ data: featureSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateFeatureRoute = createRoute({
  method: "patch",
  path: "/features/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateProductFeatureSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated feature",
      content: { "application/json": { schema: z.object({ data: featureSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product feature not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteFeatureRoute = createRoute({
  method: "delete",
  path: "/features/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Feature deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Product feature not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const featureRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listFeaturesRoute, async (c) =>
    c.json(await productsService.listFeatures(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getFeatureRoute, async (c) => {
    const row = await productsService.getFeatureById(c.get("db"), c.req.valid("param").id)
    if (!row) {
      return c.json({ error: "Product feature not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(createFeatureRoute, async (c) => {
    const productId = c.req.valid("param").id
    const body = c.req.valid("json")
    const row = await productsService.createFeature(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product feature",
      actionName: "product.feature.create",
      routeOrToolName: "products.feature.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "feature" })
    return c.json({ data: row }, 201)
  })
  .openapi(updateFeatureRoute, async (c) => {
    const featureId = c.req.valid("param").id
    const body = c.req.valid("json")
    const before = await productsService.getFeatureById(c.get("db"), featureId)
    if (!before) {
      return c.json({ error: "Product feature not found" }, 404)
    }

    const row = await productsService.updateFeature(c.get("db"), featureId, body)

    if (!row) {
      return c.json({ error: "Product feature not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product feature",
      actionName: "product.feature.update",
      routeOrToolName: "products.feature.update",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "feature" })
    return c.json({ data: row }, 200)
  })
  .openapi(deleteFeatureRoute, async (c) => {
    const featureId = c.req.valid("param").id
    const before = await productsService.getFeatureById(c.get("db"), featureId)
    if (!before) {
      return c.json({ error: "Product feature not found" }, 404)
    }

    const row = await productsService.deleteFeature(c.get("db"), featureId)

    if (!row) {
      return c.json({ error: "Product feature not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product feature",
      actionName: "product.feature.delete",
      routeOrToolName: "products.feature.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "feature" })
    return c.json({ success: true }, 200)
  })

// ==========================================================================
// FAQs
// ==========================================================================

const listFaqsRoute = createRoute({
  method: "get",
  path: "/faqs",
  request: { query: validation.productFaqListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of product FAQs",
      content: { "application/json": { schema: listResponseSchema(faqSchema) } },
    },
  },
})

const getFaqRoute = createRoute({
  method: "get",
  path: "/faqs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A product FAQ by id",
      content: { "application/json": { schema: z.object({ data: faqSchema }) } },
    },
    404: {
      description: "Product FAQ not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const createFaqRoute = createRoute({
  method: "post",
  path: "/{id}/faqs",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertProductFaqSchema } },
    },
  },
  responses: {
    201: {
      description: "The created FAQ for the product",
      content: { "application/json": { schema: z.object({ data: faqSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateFaqRoute = createRoute({
  method: "patch",
  path: "/faqs/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateProductFaqSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated FAQ",
      content: { "application/json": { schema: z.object({ data: faqSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product FAQ not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteFaqRoute = createRoute({
  method: "delete",
  path: "/faqs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "FAQ deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Product FAQ not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const faqRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listFaqsRoute, async (c) =>
    c.json(await productsService.listFaqs(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getFaqRoute, async (c) => {
    const row = await productsService.getFaqById(c.get("db"), c.req.valid("param").id)
    if (!row) {
      return c.json({ error: "Product FAQ not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(createFaqRoute, async (c) => {
    const productId = c.req.valid("param").id
    const body = c.req.valid("json")
    const row = await productsService.createFaq(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product FAQ",
      actionName: "product.faq.create",
      routeOrToolName: "products.faq.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "faq" })
    return c.json({ data: row }, 201)
  })
  .openapi(updateFaqRoute, async (c) => {
    const faqId = c.req.valid("param").id
    const body = c.req.valid("json")
    const before = await productsService.getFaqById(c.get("db"), faqId)
    if (!before) {
      return c.json({ error: "Product FAQ not found" }, 404)
    }

    const row = await productsService.updateFaq(c.get("db"), faqId, body)

    if (!row) {
      return c.json({ error: "Product FAQ not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product FAQ",
      actionName: "product.faq.update",
      routeOrToolName: "products.faq.update",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "faq" })
    return c.json({ data: row }, 200)
  })
  .openapi(deleteFaqRoute, async (c) => {
    const faqId = c.req.valid("param").id
    const before = await productsService.getFaqById(c.get("db"), faqId)
    if (!before) {
      return c.json({ error: "Product FAQ not found" }, 404)
    }

    const row = await productsService.deleteFaq(c.get("db"), faqId)

    if (!row) {
      return c.json({ error: "Product FAQ not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product FAQ",
      actionName: "product.faq.delete",
      routeOrToolName: "products.faq.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "faq" })
    return c.json({ success: true }, 200)
  })

// ==========================================================================
// Locations
// ==========================================================================

const listLocationsRoute = createRoute({
  method: "get",
  path: "/locations",
  request: { query: validation.productLocationListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of product locations",
      content: { "application/json": { schema: listResponseSchema(locationSchema) } },
    },
  },
})

const getLocationRoute = createRoute({
  method: "get",
  path: "/locations/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A product location by id",
      content: { "application/json": { schema: z.object({ data: locationSchema }) } },
    },
    404: {
      description: "Product location not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const createLocationRoute = createRoute({
  method: "post",
  path: "/{id}/locations",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertProductLocationSchema } },
    },
  },
  responses: {
    201: {
      description: "The created location for the product",
      content: { "application/json": { schema: z.object({ data: locationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateLocationRoute = createRoute({
  method: "patch",
  path: "/locations/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateProductLocationSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated location",
      content: { "application/json": { schema: z.object({ data: locationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product location not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteLocationRoute = createRoute({
  method: "delete",
  path: "/locations/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Location deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Product location not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const locationRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listLocationsRoute, async (c) =>
    c.json(await productsService.listLocations(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getLocationRoute, async (c) => {
    const row = await productsService.getLocationById(c.get("db"), c.req.valid("param").id)
    if (!row) {
      return c.json({ error: "Product location not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(createLocationRoute, async (c) => {
    const productId = c.req.valid("param").id
    const body = c.req.valid("json")
    const row = await productsService.createLocation(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product location",
      actionName: "product.location.create",
      routeOrToolName: "products.location.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "location" })
    return c.json({ data: row }, 201)
  })
  .openapi(updateLocationRoute, async (c) => {
    const locationId = c.req.valid("param").id
    const body = c.req.valid("json")
    const before = await productsService.getLocationById(c.get("db"), locationId)
    if (!before) {
      return c.json({ error: "Product location not found" }, 404)
    }

    const row = await productsService.updateLocation(c.get("db"), locationId, body)

    if (!row) {
      return c.json({ error: "Product location not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product location",
      actionName: "product.location.update",
      routeOrToolName: "products.location.update",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "location" })
    return c.json({ data: row }, 200)
  })
  .openapi(deleteLocationRoute, async (c) => {
    const locationId = c.req.valid("param").id
    const before = await productsService.getLocationById(c.get("db"), locationId)
    if (!before) {
      return c.json({ error: "Product location not found" }, 404)
    }

    const row = await productsService.deleteLocation(c.get("db"), locationId)

    if (!row) {
      return c.json({ error: "Product location not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product location",
      actionName: "product.location.delete",
      routeOrToolName: "products.location.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "location" })
    return c.json({ success: true }, 200)
  })

// ==========================================================================
// Destinations
// ==========================================================================

const listDestinationsRoute = createRoute({
  method: "get",
  path: "/destinations",
  request: { query: validation.destinationListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of destinations",
      content: { "application/json": { schema: listResponseSchema(destinationSchema) } },
    },
  },
})

const getDestinationRoute = createRoute({
  method: "get",
  path: "/destinations/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A destination by id",
      content: { "application/json": { schema: z.object({ data: destinationSchema }) } },
    },
    404: {
      description: "Destination not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const createDestinationRoute = createRoute({
  method: "post",
  path: "/destinations",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertDestinationSchema } },
    },
  },
  responses: {
    201: {
      description: "The created destination",
      content: { "application/json": { schema: z.object({ data: destinationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateDestinationRoute = createRoute({
  method: "patch",
  path: "/destinations/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateDestinationSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated destination",
      content: { "application/json": { schema: z.object({ data: destinationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Destination not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteDestinationRoute = createRoute({
  method: "delete",
  path: "/destinations/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Destination deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Destination not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const destinationRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listDestinationsRoute, async (c) =>
    c.json(await productsService.listDestinations(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getDestinationRoute, async (c) => {
    const row = await productsService.getDestinationById(c.get("db"), c.req.valid("param").id)
    if (!row) {
      return c.json({ error: "Destination not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(createDestinationRoute, async (c) => {
    const row = await productsService.createDestination(c.get("db"), c.req.valid("json"))
    if (!row) {
      // Defensive: the insert always returns the new row. Narrow the
      // service's `row ?? null` type without polluting the 201 contract.
      throw new Error("Failed to create destination")
    }
    return c.json({ data: row }, 201)
  })
  .openapi(updateDestinationRoute, async (c) => {
    const row = await productsService.updateDestination(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )

    if (!row) {
      return c.json({ error: "Destination not found" }, 404)
    }

    return c.json({ data: row }, 200)
  })
  .openapi(deleteDestinationRoute, async (c) => {
    const row = await productsService.deleteDestination(c.get("db"), c.req.valid("param").id)

    if (!row) {
      return c.json({ error: "Destination not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

// ==========================================================================
// Destination translations
// ==========================================================================

const listDestinationTranslationsRoute = createRoute({
  method: "get",
  path: "/destination-translations",
  request: { query: validation.destinationTranslationListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of destination translations",
      content: {
        "application/json": { schema: listResponseSchema(destinationTranslationSchema) },
      },
    },
  },
})

const upsertDestinationTranslationRoute = createRoute({
  method: "post",
  path: "/destinations/{id}/translations",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertDestinationTranslationSchema } },
    },
  },
  responses: {
    201: {
      description: "The created or updated destination translation",
      content: { "application/json": { schema: z.object({ data: destinationTranslationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Destination not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateDestinationTranslationRoute = createRoute({
  method: "patch",
  path: "/destination-translations/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateDestinationTranslationSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated destination translation",
      content: { "application/json": { schema: z.object({ data: destinationTranslationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Destination translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteDestinationTranslationRoute = createRoute({
  method: "delete",
  path: "/destination-translations/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Destination translation deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Destination translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const destinationTranslationRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listDestinationTranslationsRoute, async (c) =>
    c.json(
      await productsService.listDestinationTranslations(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(upsertDestinationTranslationRoute, async (c) => {
    const row = await productsService.upsertDestinationTranslation(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )

    if (!row) {
      return c.json({ error: "Destination not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })
  .openapi(updateDestinationTranslationRoute, async (c) => {
    const row = await productsService.updateDestinationTranslation(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )

    if (!row) {
      return c.json({ error: "Destination translation not found" }, 404)
    }

    return c.json({ data: row }, 200)
  })
  .openapi(deleteDestinationTranslationRoute, async (c) => {
    const row = await productsService.deleteDestinationTranslation(
      c.get("db"),
      c.req.valid("param").id,
    )

    if (!row) {
      return c.json({ error: "Destination translation not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

// ==========================================================================
// Product category translations
// ==========================================================================

const listProductCategoryTranslationsRoute = createRoute({
  method: "get",
  path: "/product-category-translations",
  request: { query: validation.productCategoryTranslationListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of product category translations",
      content: {
        "application/json": { schema: listResponseSchema(productCategoryTranslationSchema) },
      },
    },
  },
})

const upsertProductCategoryTranslationRoute = createRoute({
  method: "post",
  path: "/product-categories/{id}/translations",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: validation.insertProductCategoryTranslationSchema },
      },
    },
  },
  responses: {
    201: {
      description: "The created or updated product category translation",
      content: {
        "application/json": { schema: z.object({ data: productCategoryTranslationSchema }) },
      },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product category not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateProductCategoryTranslationRoute = createRoute({
  method: "patch",
  path: "/product-category-translations/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: validation.updateProductCategoryTranslationSchema },
      },
    },
  },
  responses: {
    200: {
      description: "The updated product category translation",
      content: {
        "application/json": { schema: z.object({ data: productCategoryTranslationSchema }) },
      },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product category translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteProductCategoryTranslationRoute = createRoute({
  method: "delete",
  path: "/product-category-translations/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Product category translation deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Product category translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const productCategoryTranslationRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})
  .openapi(listProductCategoryTranslationsRoute, async (c) =>
    c.json(
      await productsService.listProductCategoryTranslations(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(upsertProductCategoryTranslationRoute, async (c) => {
    const row = await productsService.upsertProductCategoryTranslation(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )

    if (!row) {
      return c.json({ error: "Product category not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })
  .openapi(updateProductCategoryTranslationRoute, async (c) => {
    const row = await productsService.updateProductCategoryTranslation(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )

    if (!row) {
      return c.json({ error: "Product category translation not found" }, 404)
    }

    return c.json({ data: row }, 200)
  })
  .openapi(deleteProductCategoryTranslationRoute, async (c) => {
    const row = await productsService.deleteProductCategoryTranslation(
      c.get("db"),
      c.req.valid("param").id,
    )

    if (!row) {
      return c.json({ error: "Product category translation not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

// ==========================================================================
// Product tag translations
// ==========================================================================

const listProductTagTranslationsRoute = createRoute({
  method: "get",
  path: "/product-tag-translations",
  request: { query: validation.productTagTranslationListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of product tag translations",
      content: {
        "application/json": { schema: listResponseSchema(productTagTranslationSchema) },
      },
    },
  },
})

const upsertProductTagTranslationRoute = createRoute({
  method: "post",
  path: "/product-tags/{id}/translations",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertProductTagTranslationSchema } },
    },
  },
  responses: {
    201: {
      description: "The created or updated product tag translation",
      content: {
        "application/json": { schema: z.object({ data: productTagTranslationSchema }) },
      },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product tag not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateProductTagTranslationRoute = createRoute({
  method: "patch",
  path: "/product-tag-translations/{id}",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateProductTagTranslationSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated product tag translation",
      content: {
        "application/json": { schema: z.object({ data: productTagTranslationSchema }) },
      },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product tag translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteProductTagTranslationRoute = createRoute({
  method: "delete",
  path: "/product-tag-translations/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Product tag translation deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Product tag translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const productTagTranslationRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listProductTagTranslationsRoute, async (c) =>
    c.json(
      await productsService.listProductTagTranslations(c.get("db"), c.req.valid("query")),
      200,
    ),
  )
  .openapi(upsertProductTagTranslationRoute, async (c) => {
    const row = await productsService.upsertProductTagTranslation(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )

    if (!row) {
      return c.json({ error: "Product tag not found" }, 404)
    }

    return c.json({ data: row }, 201)
  })
  .openapi(updateProductTagTranslationRoute, async (c) => {
    const row = await productsService.updateProductTagTranslation(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )

    if (!row) {
      return c.json({ error: "Product tag translation not found" }, 404)
    }

    return c.json({ data: row }, 200)
  })
  .openapi(deleteProductTagTranslationRoute, async (c) => {
    const row = await productsService.deleteProductTagTranslation(
      c.get("db"),
      c.req.valid("param").id,
    )

    if (!row) {
      return c.json({ error: "Product tag translation not found" }, 404)
    }

    return c.json({ success: true }, 200)
  })

// ==========================================================================
// Product ↔ destination links
// ==========================================================================

const listDestinationLinksRoute = createRoute({
  method: "get",
  path: "/destination-links",
  request: { query: validation.productDestinationListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of product↔destination links (joins destinations)",
      content: {
        "application/json": { schema: listResponseSchema(productDestinationListItemSchema) },
      },
    },
  },
})

const assignDestinationLinkRoute = createRoute({
  method: "post",
  path: "/{id}/destinations",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertProductDestinationSchema } },
    },
  },
  responses: {
    201: {
      description: "The created product↔destination link",
      content: { "application/json": { schema: z.object({ data: productDestinationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product or destination not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const removeDestinationLinkRoute = createRoute({
  method: "delete",
  path: "/{id}/destinations/{destinationId}",
  request: { params: z.object({ id: z.string(), destinationId: z.string() }) },
  responses: {
    200: {
      description: "Product destination link deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Product destination link not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const productDestinationLinkRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listDestinationLinksRoute, async (c) =>
    c.json(await productsService.listProductDestinations(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(assignDestinationLinkRoute, async (c) => {
    const productId = c.req.valid("param").id
    const body = c.req.valid("json")
    const row = await productsService.assignProductDestination(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product or destination not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product destination link",
      actionName: "product.destination_link.create",
      routeOrToolName: "products.destination_link.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "destination" })
    return c.json({ data: row }, 201)
  })
  .openapi(removeDestinationLinkRoute, async (c) => {
    const { id: productId, destinationId } = c.req.valid("param")
    const row = await productsService.removeProductDestination(
      c.get("db"),
      productId,
      destinationId,
    )

    if (!row) {
      return c.json({ error: "Product destination link not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId,
      changedFields: [],
      subject: "product destination link",
      actionName: "product.destination_link.delete",
      routeOrToolName: "products.destination_link.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "destination" })
    return c.json({ success: true }, 200)
  })

// Mount each per-resource child sub-chain on the merchandising parent. Static
// collection paths are registered inside each child before its `/{id}` legs;
// the static-first destination resource is mounted before the dynamic
// `/{id}/destinations` link resource so create-destination wins over the
// link-assignment catch-all.
export const productMerchandisingRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})
  .route("/", featureRoutes)
  .route("/", faqRoutes)
  .route("/", locationRoutes)
  .route("/", destinationRoutes)
  .route("/", destinationTranslationRoutes)
  .route("/", productCategoryTranslationRoutes)
  .route("/", productTagTranslationRoutes)
  .route("/", productDestinationLinkRoutes)

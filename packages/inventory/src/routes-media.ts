// agent-quality: file-size exception -- owner: inventory; existing media route groups stay co-located to preserve static-before-dynamic mount ordering until a dedicated route split preserves behavior and tests.
/**
 * Admin product media + brochure routes — media metadata CRUD (product- and
 * day-level), cover selection, ordering, and the canonical/versioned brochure
 * surface. Mounted by the operator starter under `/v1/admin/products/...` on the
 * (already `OpenAPIHono`) parent `productRoutes` (staff-actor gated by the
 * parent app's middleware chain).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * inventory media sub-batch). Request schemas reuse the existing
 * `@voyant-travel/products-contracts` validation schemas the handlers already
 * parse; the response row schema is authored from the Drizzle `product_media`
 * `$inferSelect` shape in `schema-itinerary.ts` (§17: `Date`/timestamp columns
 * serialize to strings over the wire; integer fields stay numbers). Business
 * logic, auth, action-ledger writes, and content-changed events are unchanged;
 * handlers read `c.req.valid(...)`.
 *
 * Each resource is its own child `OpenAPIHono` sub-chain mounted via
 * `.route("/", child)` so the parent stays shallow (avoids the O(n²) tsc blowup
 * of one long flat `.openapi(...)` chain). The static `/media/{mediaId}` item
 * resource is mounted before the dynamic `/{id}/...` brochure + nested-media
 * resources. The upload + binary-serve surface lives in `@voyant-travel/storage`
 * (`createMediaRoutes`) and the brochure *generation* route lives in
 * `routes-brochure.ts`; neither is part of this metadata module.
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

const mediaIdParamSchema = z.object({ mediaId: z.string() })
const idParamSchema = z.object({ id: z.string() })
const brochureVersionParamSchema = z.object({ id: z.string(), brochureId: z.string() })
const dayMediaParamSchema = z.object({ id: z.string(), dayId: z.string() })

/** §17: timestamp columns are ISO strings over the wire. */
const isoTimestamp = z.string()

const mediaTypeValues = ["image", "video", "document"] as const

// --- Response row schema (authored from the `product_media` $inferSelect shape) ---

const mediaSchema = z.object({
  id: z.string(),
  productId: z.string(),
  dayId: z.string().nullable(),
  mediaType: z.enum(mediaTypeValues),
  name: z.string(),
  url: z.string(),
  storageKey: z.string().nullable(),
  mimeType: z.string().nullable(),
  fileSize: z.number().nullable(),
  altText: z.string().nullable(),
  assetId: z.string().nullable(),
  sortOrder: z.number(),
  isCover: z.boolean(),
  isBrochure: z.boolean(),
  isBrochureCurrent: z.boolean(),
  brochureVersion: z.number().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// ==========================================================================
// Media items (`/media/{mediaId}`) — static resource, mounted first.
// ==========================================================================

const getMediaRoute = createRoute({
  method: "get",
  path: "/media/{mediaId}",
  request: { params: mediaIdParamSchema },
  responses: {
    200: {
      description: "A single media item by id",
      content: { "application/json": { schema: z.object({ data: mediaSchema }) } },
    },
    404: {
      description: "Media not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateMediaRoute = createRoute({
  method: "patch",
  path: "/media/{mediaId}",
  request: {
    params: mediaIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateProductMediaSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated media item",
      content: { "application/json": { schema: z.object({ data: mediaSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Media not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const setCoverMediaRoute = createRoute({
  method: "patch",
  path: "/media/{mediaId}/set-cover",
  request: { params: mediaIdParamSchema },
  responses: {
    200: {
      description: "The media item set as cover",
      content: { "application/json": { schema: z.object({ data: mediaSchema }) } },
    },
    404: {
      description: "Media not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    400: {
      description: "Only image media can be set as cover",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    500: {
      description: "Failed to set cover",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteMediaRoute = createRoute({
  method: "delete",
  path: "/media/{mediaId}",
  request: { params: mediaIdParamSchema },
  responses: {
    200: {
      description: "The deleted media item",
      content: { "application/json": { schema: z.object({ data: mediaSchema }) } },
    },
    404: {
      description: "Media not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const mediaItemRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(getMediaRoute, async (c) => {
    const row = await productsService.getMediaById(c.get("db"), c.req.valid("param").mediaId)
    if (!row) {
      return c.json({ error: "Media not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(setCoverMediaRoute, async (c) => {
    const media = await productsService.getMediaById(c.get("db"), c.req.valid("param").mediaId)
    if (!media) {
      return c.json({ error: "Media not found" }, 404)
    }
    if (media.mediaType !== "image") {
      return c.json({ error: "Only image media can be set as cover" }, 400)
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
    return c.json({ data: row }, 200)
  })
  .openapi(updateMediaRoute, async (c) => {
    const mediaId = c.req.valid("param").mediaId
    const body = c.req.valid("json")
    const before = await productsService.getMediaById(c.get("db"), mediaId)
    if (!before) {
      return c.json({ error: "Media not found" }, 404)
    }
    const nextMediaType = body.mediaType ?? before.mediaType
    const nextIsCover = body.isCover ?? before.isCover
    if (nextIsCover && nextMediaType !== "image") {
      return c.json({ error: "Only image media can be set as cover" }, 400)
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
    return c.json({ data: row }, 200)
  })
  .openapi(deleteMediaRoute, async (c) => {
    const mediaId = c.req.valid("param").mediaId
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
    return c.json({ data: row }, 200)
  })

// ==========================================================================
// Brochure (`/{id}/brochure...`) — canonical + versioned product brochure.
// ==========================================================================

const getBrochureRoute = createRoute({
  method: "get",
  path: "/{id}/brochure",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The canonical (current) brochure for a product",
      content: { "application/json": { schema: z.object({ data: mediaSchema }) } },
    },
    404: {
      description: "Product brochure not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const listBrochureVersionsRoute = createRoute({
  method: "get",
  path: "/{id}/brochure/versions",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Brochure version history for a product",
      content: { "application/json": { schema: z.object({ data: z.array(mediaSchema) }) } },
    },
  },
})

const upsertBrochureRoute = createRoute({
  method: "put",
  path: "/{id}/brochure",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.upsertProductBrochureSchema } },
    },
  },
  responses: {
    201: {
      description: "The created brochure version (promoted to current)",
      content: { "application/json": { schema: z.object({ data: mediaSchema }) } },
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

const deleteBrochureRoute = createRoute({
  method: "delete",
  path: "/{id}/brochure",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The deleted canonical brochure",
      content: { "application/json": { schema: z.object({ data: mediaSchema }) } },
    },
    404: {
      description: "Product brochure not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const setCurrentBrochureRoute = createRoute({
  method: "post",
  path: "/{id}/brochure/versions/{brochureId}/set-current",
  request: { params: brochureVersionParamSchema },
  responses: {
    200: {
      description: "The brochure version promoted to current",
      content: { "application/json": { schema: z.object({ data: mediaSchema }) } },
    },
    404: {
      description: "Product brochure version not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteBrochureVersionRoute = createRoute({
  method: "delete",
  path: "/{id}/brochure/versions/{brochureId}",
  request: { params: brochureVersionParamSchema },
  responses: {
    200: {
      description: "The deleted brochure version",
      content: { "application/json": { schema: z.object({ data: mediaSchema }) } },
    },
    404: {
      description: "Product brochure version not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const brochureRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listBrochureVersionsRoute, async (c) =>
    c.json(
      { data: await productsService.listBrochures(c.get("db"), c.req.valid("param").id) },
      200,
    ),
  )
  .openapi(setCurrentBrochureRoute, async (c) => {
    const { id: productId, brochureId } = c.req.valid("param")
    const row = await productsService.setCurrentBrochure(c.get("db"), productId, brochureId)
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
    return c.json({ data: row }, 200)
  })
  .openapi(deleteBrochureVersionRoute, async (c) => {
    const { id: productId, brochureId } = c.req.valid("param")
    const row = await productsService.deleteBrochureVersion(c.get("db"), productId, brochureId)
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
    return c.json({ data: row }, 200)
  })
  .openapi(getBrochureRoute, async (c) => {
    const row = await productsService.getBrochure(c.get("db"), c.req.valid("param").id)
    if (!row) {
      return c.json({ error: "Product brochure not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(upsertBrochureRoute, async (c) => {
    const productId = c.req.valid("param").id
    const body = c.req.valid("json")
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
  .openapi(deleteBrochureRoute, async (c) => {
    const productId = c.req.valid("param").id
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
    return c.json({ data: row }, 200)
  })

// ==========================================================================
// Product media (nested under product) — `/{id}/media`, `/{id}/days/{dayId}/media`.
// ==========================================================================

const reorderResultSchema = z.object({ data: z.array(z.object({ id: z.string() })) })

const listProductMediaRoute = createRoute({
  method: "get",
  path: "/{id}/media",
  request: { params: idParamSchema, query: validation.productMediaListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of product-level media",
      content: { "application/json": { schema: listResponseSchema(mediaSchema) } },
    },
  },
})

const createProductMediaRoute = createRoute({
  method: "post",
  path: "/{id}/media",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertProductMediaSchema } },
    },
  },
  responses: {
    201: {
      description: "The created media item",
      content: { "application/json": { schema: z.object({ data: mediaSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product not found or invalid dayId",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const reorderProductMediaRoute = createRoute({
  method: "post",
  path: "/{id}/media/reorder",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.reorderProductMediaSchema } },
    },
  },
  responses: {
    200: {
      description: "The reordered media item ids",
      content: { "application/json": { schema: reorderResultSchema } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const listDayMediaRoute = createRoute({
  method: "get",
  path: "/{id}/days/{dayId}/media",
  request: { params: dayMediaParamSchema, query: validation.productMediaListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of media for a product day",
      content: { "application/json": { schema: listResponseSchema(mediaSchema) } },
    },
  },
})

const createDayMediaRoute = createRoute({
  method: "post",
  path: "/{id}/days/{dayId}/media",
  request: {
    params: dayMediaParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertProductMediaSchema } },
    },
  },
  responses: {
    201: {
      description: "The created day media item",
      content: { "application/json": { schema: z.object({ data: mediaSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product or day not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const productMediaNestedRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(reorderProductMediaRoute, async (c) => {
    const productId = c.req.valid("param").id
    const data = c.req.valid("json")
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
    return c.json({ data: results }, 200)
  })
  .openapi(listProductMediaRoute, async (c) =>
    c.json(
      await productsService.listProductLevelMedia(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("query"),
      ),
      200,
    ),
  )
  .openapi(createProductMediaRoute, async (c) => {
    const productId = c.req.valid("param").id
    const body = c.req.valid("json")
    if (body.isCover && body.mediaType !== "image") {
      return c.json({ error: "Only image media can be set as cover" }, 400)
    }
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
  .openapi(listDayMediaRoute, async (c) => {
    const { id, dayId } = c.req.valid("param")
    return c.json(
      await productsService.listMedia(c.get("db"), id, {
        ...c.req.valid("query"),
        dayId,
      }),
      200,
    )
  })
  .openapi(createDayMediaRoute, async (c) => {
    const { id: productId, dayId } = c.req.valid("param")
    const body = c.req.valid("json")
    if (body.isCover && body.mediaType !== "image") {
      return c.json({ error: "Only image media can be set as cover" }, 400)
    }
    const row = await productsService.createMedia(c.get("db"), productId, {
      ...body,
      dayId,
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

// Mount each per-resource child sub-chain on the media parent. The static
// `/media/{mediaId}` item resource is mounted before the dynamic `/{id}/...`
// brochure + nested-media resources so its literal first segment wins over the
// `:id` param routes.
export const productMediaRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .route("/", mediaItemRoutes)
  .route("/", brochureRoutes)
  .route("/", productMediaNestedRoutes)

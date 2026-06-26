/**
 * Admin product association routes (product <-> category, product <-> tag) —
 * mounted by the operator starter under `/v1/admin/products/...` (staff-actor
 * gated by the parent app's middleware chain).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * inventory core sub-batch). The category/tag list responses are authored from
 * the Drizzle `productCategories` / `productTags` `$inferSelect` shapes (§17:
 * timestamp columns serialize to ISO strings over the wire). The link
 * mutations return a bare `{ success }` envelope. Two per-resource
 * `OpenAPIHono` sub-chains (categories, tags) are composed onto
 * `productAssociationRoutes` so the `.openapi()` operations propagate up.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"

import { appendProductMutationLedgerEntry, changedMutationFields } from "./action-ledger.js"
import { emitProductContentChanged } from "./events.js"
import type { Env } from "./route-env.js"
import { productsService } from "./service.js"

const errorResponseSchema = z.object({ error: z.string() })
const successResponseSchema = z.object({ success: z.boolean() })

/** §17: timestamp columns are ISO strings over the wire. */
const isoTimestamp = z.string()

// --- Response row schemas (authored from the Drizzle $inferSelect shapes) ---

const productCategorySchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  active: z.boolean(),
  customerPaymentPolicy: z.unknown().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const productTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const idParamSchema = z.object({ id: z.string() })

// ==========================================================================
// Product <-> Category associations
// ==========================================================================

const listProductCategoriesRoute = createRoute({
  method: "get",
  path: "/{id}/categories",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Categories the product is assigned to (sort-order ascending)",
      content: {
        "application/json": { schema: z.object({ data: z.array(productCategorySchema) }) },
      },
    },
  },
})

const addProductCategoryRoute = createRoute({
  method: "post",
  path: "/{id}/categories",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({ categoryId: z.string(), sortOrder: z.number().optional() }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "The category was assigned to the product",
      content: { "application/json": { schema: successResponseSchema } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "Already assigned, or product/category not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const removeProductCategoryRoute = createRoute({
  method: "delete",
  path: "/{id}/categories/{categoryId}",
  request: { params: z.object({ id: z.string(), categoryId: z.string() }) },
  responses: {
    200: {
      description: "The category was unassigned from the product",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: {
      description: "Association not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const productCategoryRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listProductCategoriesRoute, async (c) =>
    c.json(
      { data: await productsService.listProductCategories_(c.get("db"), c.req.valid("param").id) },
      200,
    ),
  )
  .openapi(addProductCategoryRoute, async (c) => {
    const productId = c.req.valid("param").id
    const body = c.req.valid("json")
    const { categoryId, sortOrder } = body
    const row = await productsService.addProductToCategory(
      c.get("db"),
      productId,
      categoryId,
      sortOrder,
    )
    if (!row) {
      return c.json({ error: "Already assigned or not found" }, 409)
    }
    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product category link",
      actionName: "product.category_link.create",
      routeOrToolName: "products.category_link.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "category" })
    return c.json({ success: true }, 201)
  })
  .openapi(removeProductCategoryRoute, async (c) => {
    const productId = c.req.valid("param").id
    const row = await productsService.removeProductFromCategory(
      c.get("db"),
      productId,
      c.req.valid("param").categoryId,
    )
    if (!row) {
      return c.json({ error: "Association not found" }, 404)
    }
    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId,
      changedFields: [],
      subject: "product category link",
      actionName: "product.category_link.delete",
      routeOrToolName: "products.category_link.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "category" })
    return c.json({ success: true }, 200)
  })

// ==========================================================================
// Product <-> Tag associations
// ==========================================================================

const listProductTagsRoute = createRoute({
  method: "get",
  path: "/{id}/tags",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Tags the product is assigned to (name ascending)",
      content: { "application/json": { schema: z.object({ data: z.array(productTagSchema) }) } },
    },
  },
})

const addProductTagRoute = createRoute({
  method: "post",
  path: "/{id}/tags",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: z.object({ tagId: z.string() }) } },
    },
  },
  responses: {
    201: {
      description: "The tag was assigned to the product",
      content: { "application/json": { schema: successResponseSchema } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "Already assigned, or product/tag not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const removeProductTagRoute = createRoute({
  method: "delete",
  path: "/{id}/tags/{tagId}",
  request: { params: z.object({ id: z.string(), tagId: z.string() }) },
  responses: {
    200: {
      description: "The tag was unassigned from the product",
      content: { "application/json": { schema: successResponseSchema } },
    },
    404: {
      description: "Association not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const productTagRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listProductTagsRoute, async (c) =>
    c.json(
      { data: await productsService.listProductTags_(c.get("db"), c.req.valid("param").id) },
      200,
    ),
  )
  .openapi(addProductTagRoute, async (c) => {
    const productId = c.req.valid("param").id
    const body = c.req.valid("json")
    const { tagId } = body
    const row = await productsService.addProductTag(c.get("db"), productId, tagId)
    if (!row) {
      return c.json({ error: "Already assigned or not found" }, 409)
    }
    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product tag link",
      actionName: "product.tag_link.create",
      routeOrToolName: "products.tag_link.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "tag" })
    return c.json({ success: true }, 201)
  })
  .openapi(removeProductTagRoute, async (c) => {
    const productId = c.req.valid("param").id
    const row = await productsService.removeProductTag(
      c.get("db"),
      productId,
      c.req.valid("param").tagId,
    )
    if (!row) {
      return c.json({ error: "Association not found" }, 404)
    }
    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId,
      changedFields: [],
      subject: "product tag link",
      actionName: "product.tag_link.delete",
      routeOrToolName: "products.tag_link.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "tag" })
    return c.json({ success: true }, 200)
  })

// Compose the two per-resource sub-chains onto a single OpenAPIHono so the
// `.openapi()` operations propagate up through the parent `productRoutes`
// registry (OpenAPIHono.route copies the sub-app's registered routes).
export const productAssociationRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .route("/", productCategoryRoutes)
  .route("/", productTagRoutes)

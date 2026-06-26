/**
 * Admin product translation routes — product translations, product option
 * translations, and option unit translations (locale-aware names/descriptions).
 * Mounted by the operator starter under `/v1/admin/products/...` on the (already
 * `OpenAPIHono`) parent `productRoutes` (staff-actor gated by the parent app's
 * middleware chain).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * inventory translations sub-batch). Request schemas reuse the existing
 * `@voyant-travel/products-contracts` validation schemas the handlers already
 * parse; response row schemas are authored from the Drizzle `$inferSelect`
 * shapes in `schema-settings.ts` (§17: `Date`/timestamp columns serialize to
 * strings over the wire). Business logic, auth, action-ledger writes, and
 * content-changed events are unchanged; handlers read `c.req.valid(...)`.
 *
 * Each resource is its own child `OpenAPIHono` sub-chain mounted via
 * `.route("/", child)` so the parent stays shallow (avoids the O(n²) tsc blowup
 * of one long flat `.openapi(...)` chain). Within each child the static
 * collection paths are registered before the dynamic `/{translationId}` legs.
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

/** §17: timestamp columns are ISO strings over the wire. */
const isoTimestamp = z.string()

const productIdParamSchema = z.object({ id: z.string() })
const translationIdParamSchema = z.object({ translationId: z.string() })
const optionIdParamSchema = z.object({ optionId: z.string() })
const unitIdParamSchema = z.object({ unitId: z.string() })

// --- Response row schemas (authored from the Drizzle `$inferSelect` shapes) ---

const productTranslationSchema = z.object({
  id: z.string(),
  productId: z.string(),
  languageTag: z.string(),
  slug: z.string().nullable(),
  name: z.string(),
  shortDescription: z.string().nullable(),
  description: z.string().nullable(),
  inclusionsHtml: z.string().nullable(),
  exclusionsHtml: z.string().nullable(),
  termsHtml: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const optionTranslationSchema = z.object({
  id: z.string(),
  optionId: z.string(),
  languageTag: z.string(),
  name: z.string(),
  shortDescription: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const unitTranslationSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  languageTag: z.string(),
  name: z.string(),
  shortDescription: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// ==========================================================================
// Product translations
// ==========================================================================

const listProductTranslationsRoute = createRoute({
  method: "get",
  path: "/translations",
  request: { query: validation.productTranslationListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of product translations",
      content: { "application/json": { schema: listResponseSchema(productTranslationSchema) } },
    },
  },
})

const getProductTranslationRoute = createRoute({
  method: "get",
  path: "/translations/{translationId}",
  request: { params: translationIdParamSchema },
  responses: {
    200: {
      description: "A product translation by id",
      content: { "application/json": { schema: z.object({ data: productTranslationSchema }) } },
    },
    404: {
      description: "Product translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const createProductTranslationRoute = createRoute({
  method: "post",
  path: "/{id}/translations",
  request: {
    params: productIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertProductTranslationSchema } },
    },
  },
  responses: {
    201: {
      description: "The created product translation",
      content: { "application/json": { schema: z.object({ data: productTranslationSchema }) } },
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

const updateProductTranslationRoute = createRoute({
  method: "patch",
  path: "/translations/{translationId}",
  request: {
    params: translationIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateProductTranslationSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated product translation",
      content: { "application/json": { schema: z.object({ data: productTranslationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteProductTranslationRoute = createRoute({
  method: "delete",
  path: "/translations/{translationId}",
  request: { params: translationIdParamSchema },
  responses: {
    200: {
      description: "Product translation deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Product translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const productTranslationRoutesChild = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listProductTranslationsRoute, async (c) =>
    c.json(await productsService.listProductTranslations(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getProductTranslationRoute, async (c) => {
    const row = await productsService.getProductTranslationById(
      c.get("db"),
      c.req.valid("param").translationId,
    )
    if (!row) {
      return c.json({ error: "Product translation not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(createProductTranslationRoute, async (c) => {
    const productId = c.req.valid("param").id
    const body = c.req.valid("json")
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
  .openapi(updateProductTranslationRoute, async (c) => {
    const translationId = c.req.valid("param").translationId
    const body = c.req.valid("json")
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
    return c.json({ data: row }, 200)
  })
  .openapi(deleteProductTranslationRoute, async (c) => {
    const translationId = c.req.valid("param").translationId
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

// ==========================================================================
// Product option translations
// ==========================================================================

const listOptionTranslationsRoute = createRoute({
  method: "get",
  path: "/option-translations",
  request: { query: validation.productOptionTranslationListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of product option translations",
      content: { "application/json": { schema: listResponseSchema(optionTranslationSchema) } },
    },
  },
})

const getOptionTranslationRoute = createRoute({
  method: "get",
  path: "/option-translations/{translationId}",
  request: { params: translationIdParamSchema },
  responses: {
    200: {
      description: "A product option translation by id",
      content: { "application/json": { schema: z.object({ data: optionTranslationSchema }) } },
    },
    404: {
      description: "Option translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const createOptionTranslationRoute = createRoute({
  method: "post",
  path: "/options/{optionId}/translations",
  request: {
    params: optionIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertProductOptionTranslationSchema } },
    },
  },
  responses: {
    201: {
      description: "The created product option translation",
      content: { "application/json": { schema: z.object({ data: optionTranslationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Product option not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateOptionTranslationRoute = createRoute({
  method: "patch",
  path: "/option-translations/{translationId}",
  request: {
    params: translationIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateProductOptionTranslationSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated product option translation",
      content: { "application/json": { schema: z.object({ data: optionTranslationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Option translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteOptionTranslationRoute = createRoute({
  method: "delete",
  path: "/option-translations/{translationId}",
  request: { params: translationIdParamSchema },
  responses: {
    200: {
      description: "Option translation deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Option translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const optionTranslationRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listOptionTranslationsRoute, async (c) =>
    c.json(await productsService.listOptionTranslations(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getOptionTranslationRoute, async (c) => {
    const row = await productsService.getOptionTranslationById(
      c.get("db"),
      c.req.valid("param").translationId,
    )
    if (!row) {
      return c.json({ error: "Option translation not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(createOptionTranslationRoute, async (c) => {
    const optionId = c.req.valid("param").optionId
    const body = c.req.valid("json")
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
  .openapi(updateOptionTranslationRoute, async (c) => {
    const translationId = c.req.valid("param").translationId
    const body = c.req.valid("json")
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
    return c.json({ data: row }, 200)
  })
  .openapi(deleteOptionTranslationRoute, async (c) => {
    const translationId = c.req.valid("param").translationId
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

// ==========================================================================
// Option unit translations
// ==========================================================================

const listUnitTranslationsRoute = createRoute({
  method: "get",
  path: "/unit-translations",
  request: { query: validation.optionUnitTranslationListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of option unit translations",
      content: { "application/json": { schema: listResponseSchema(unitTranslationSchema) } },
    },
  },
})

const getUnitTranslationRoute = createRoute({
  method: "get",
  path: "/unit-translations/{translationId}",
  request: { params: translationIdParamSchema },
  responses: {
    200: {
      description: "An option unit translation by id",
      content: { "application/json": { schema: z.object({ data: unitTranslationSchema }) } },
    },
    404: {
      description: "Unit translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const createUnitTranslationRoute = createRoute({
  method: "post",
  path: "/units/{unitId}/translations",
  request: {
    params: unitIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertOptionUnitTranslationSchema } },
    },
  },
  responses: {
    201: {
      description: "The created option unit translation",
      content: { "application/json": { schema: z.object({ data: unitTranslationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Option unit not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const updateUnitTranslationRoute = createRoute({
  method: "patch",
  path: "/unit-translations/{translationId}",
  request: {
    params: translationIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateOptionUnitTranslationSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated option unit translation",
      content: { "application/json": { schema: z.object({ data: unitTranslationSchema }) } },
    },
    400: {
      description: "invalid_request: request body failed validation",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Unit translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const deleteUnitTranslationRoute = createRoute({
  method: "delete",
  path: "/unit-translations/{translationId}",
  request: { params: translationIdParamSchema },
  responses: {
    200: {
      description: "Unit translation deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Unit translation not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const unitTranslationRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listUnitTranslationsRoute, async (c) =>
    c.json(await productsService.listUnitTranslations(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getUnitTranslationRoute, async (c) => {
    const row = await productsService.getUnitTranslationById(
      c.get("db"),
      c.req.valid("param").translationId,
    )
    if (!row) {
      return c.json({ error: "Unit translation not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(createUnitTranslationRoute, async (c) => {
    const unitId = c.req.valid("param").unitId
    const body = c.req.valid("json")
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
  .openapi(updateUnitTranslationRoute, async (c) => {
    const translationId = c.req.valid("param").translationId
    const body = c.req.valid("json")
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
    return c.json({ data: row }, 200)
  })
  .openapi(deleteUnitTranslationRoute, async (c) => {
    const translationId = c.req.valid("param").translationId
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

// Mount each per-resource child sub-chain on the translations parent. The three
// translation resources live under disjoint path prefixes, so mount order
// between them is immaterial; within each child the static collection paths are
// registered before the dynamic `/{translationId}` legs.
export const productTranslationRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})
  .route("/", productTranslationRoutesChild)
  .route("/", optionTranslationRoutes)
  .route("/", unitTranslationRoutes)

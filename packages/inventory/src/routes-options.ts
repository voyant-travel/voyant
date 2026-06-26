/**
 * Admin product options + option-units routes. Mounted by the operator starter
 * under `/v1/admin/products/...` on the (already `OpenAPIHono`) parent
 * `productRoutes` (staff-actor gated by the parent app's middleware chain).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * inventory options sub-batch). Request schemas reuse the existing
 * `@voyant-travel/products-contracts` validation schemas the handlers already
 * parse; response row schemas are authored from the Drizzle `$inferSelect`
 * shapes in `schema-core.ts` (`productOptions`, `optionUnits` — §17:
 * `Date`/timestamp columns serialize to strings over the wire, `date` columns
 * are strings, integer fields stay numbers). Business logic, auth, content-axis
 * event emission, and action-ledger writes are unchanged; handlers read
 * `c.req.valid(...)`.
 *
 * Options and units are each their own child `OpenAPIHono` sub-chain (~5 legs)
 * mounted via `.route("/", child)` so the parent stays shallow (avoids the
 * O(n²) tsc blowup of one long flat `.openapi(...)` chain). Within each child,
 * the static collection paths are registered before the dynamic legs.
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
const optionIdParamSchema = z.object({ optionId: z.string() })
const unitIdParamSchema = z.object({ unitId: z.string() })
const successSchema = z.object({ success: z.boolean() })

/** §17: timestamp columns are ISO strings over the wire. */
const isoTimestamp = z.string()

const optionStatusValues = ["draft", "active", "archived"] as const
const unitTypeValues = ["person", "group", "room", "vehicle", "service", "other"] as const

// --- Response row schemas (authored from the Drizzle `$inferSelect` shapes) ---

const productOptionSchema = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  status: z.enum(optionStatusValues),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  availableFrom: z.string().nullable(),
  availableTo: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const optionUnitSchema = z.object({
  id: z.string(),
  optionId: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  description: z.string().nullable(),
  unitType: z.enum(unitTypeValues),
  minQuantity: z.number().int().nullable(),
  maxQuantity: z.number().int().nullable(),
  minAge: z.number().int().nullable(),
  maxAge: z.number().int().nullable(),
  occupancyMin: z.number().int().nullable(),
  occupancyMax: z.number().int().nullable(),
  isRequired: z.boolean(),
  isHidden: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// ==========================================================================
// Options
// ==========================================================================

const listOptionsRoute = createRoute({
  method: "get",
  path: "/options",
  request: { query: validation.productOptionListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of product options",
      content: { "application/json": { schema: listResponseSchema(productOptionSchema) } },
    },
  },
})

const getOptionRoute = createRoute({
  method: "get",
  path: "/options/{optionId}",
  request: { params: optionIdParamSchema },
  responses: {
    200: {
      description: "A product option by id",
      content: { "application/json": { schema: z.object({ data: productOptionSchema }) } },
    },
    404: {
      description: "Product option not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const createOptionRoute = createRoute({
  method: "post",
  path: "/{id}/options",
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertProductOptionSchema } },
    },
  },
  responses: {
    201: {
      description: "The created option for the product",
      content: { "application/json": { schema: z.object({ data: productOptionSchema }) } },
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

const updateOptionRoute = createRoute({
  method: "patch",
  path: "/options/{optionId}",
  request: {
    params: optionIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateProductOptionSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated option",
      content: { "application/json": { schema: z.object({ data: productOptionSchema }) } },
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

const deleteOptionRoute = createRoute({
  method: "delete",
  path: "/options/{optionId}",
  request: { params: optionIdParamSchema },
  responses: {
    200: {
      description: "Option deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Product option not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const optionRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listOptionsRoute, async (c) =>
    c.json(await productsService.listOptions(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getOptionRoute, async (c) => {
    const row = await productsService.getOptionById(c.get("db"), c.req.valid("param").optionId)
    if (!row) {
      return c.json({ error: "Product option not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(createOptionRoute, async (c) => {
    const productId = c.req.valid("param").id
    const body = c.req.valid("json")
    const row = await productsService.createOption(c.get("db"), productId, body)

    if (!row) {
      return c.json({ error: "Product not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product option",
      actionName: "product.option.create",
      routeOrToolName: "products.option.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "option" })
    return c.json({ data: row }, 201)
  })
  .openapi(updateOptionRoute, async (c) => {
    const optionId = c.req.valid("param").optionId
    const body = c.req.valid("json")
    const before = await productsService.getOptionById(c.get("db"), optionId)
    if (!before) {
      return c.json({ error: "Product option not found" }, 404)
    }

    const row = await productsService.updateOption(c.get("db"), optionId, body)

    if (!row) {
      return c.json({ error: "Product option not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: row.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product option",
      actionName: "product.option.update",
      routeOrToolName: "products.option.update",
    })
    if (row.productId) {
      await emitProductContentChanged(c.get("eventBus"), { id: row.productId, axis: "option" })
    }
    return c.json({ data: row }, 200)
  })
  .openapi(deleteOptionRoute, async (c) => {
    const optionId = c.req.valid("param").optionId
    const before = await productsService.getOptionById(c.get("db"), optionId)
    if (!before) {
      return c.json({ error: "Product option not found" }, 404)
    }

    const row = await productsService.deleteOption(c.get("db"), optionId)

    if (!row) {
      return c.json({ error: "Product option not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product option",
      actionName: "product.option.delete",
      routeOrToolName: "products.option.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "option" })
    return c.json({ success: true }, 200)
  })

// ==========================================================================
// Option Units
// ==========================================================================

const listUnitsRoute = createRoute({
  method: "get",
  path: "/units",
  request: { query: validation.optionUnitListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of option units",
      content: { "application/json": { schema: listResponseSchema(optionUnitSchema) } },
    },
  },
})

const getUnitRoute = createRoute({
  method: "get",
  path: "/units/{unitId}",
  request: { params: unitIdParamSchema },
  responses: {
    200: {
      description: "An option unit by id",
      content: { "application/json": { schema: z.object({ data: optionUnitSchema }) } },
    },
    404: {
      description: "Option unit not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const createUnitRoute = createRoute({
  method: "post",
  path: "/options/{optionId}/units",
  request: {
    params: optionIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.insertOptionUnitSchema } },
    },
  },
  responses: {
    201: {
      description: "The created unit for the option",
      content: { "application/json": { schema: z.object({ data: optionUnitSchema }) } },
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

const updateUnitRoute = createRoute({
  method: "patch",
  path: "/units/{unitId}",
  request: {
    params: unitIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: validation.updateOptionUnitSchema } },
    },
  },
  responses: {
    200: {
      description: "The updated unit",
      content: { "application/json": { schema: z.object({ data: optionUnitSchema }) } },
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

const deleteUnitRoute = createRoute({
  method: "delete",
  path: "/units/{unitId}",
  request: { params: unitIdParamSchema },
  responses: {
    200: {
      description: "Unit deleted",
      content: { "application/json": { schema: successSchema } },
    },
    404: {
      description: "Option unit not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const unitRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listUnitsRoute, async (c) =>
    c.json(await productsService.listUnits(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(getUnitRoute, async (c) => {
    const row = await productsService.getUnitById(c.get("db"), c.req.valid("param").unitId)
    if (!row) {
      return c.json({ error: "Option unit not found" }, 404)
    }
    return c.json({ data: row }, 200)
  })
  .openapi(createUnitRoute, async (c) => {
    const optionId = c.req.valid("param").optionId
    const body = c.req.valid("json")
    const option = await productsService.getOptionById(c.get("db"), optionId)
    if (!option) {
      return c.json({ error: "Product option not found" }, 404)
    }

    const row = await productsService.createUnit(c.get("db"), optionId, body)

    if (!row) {
      return c.json({ error: "Product option not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "create",
      productId: option.productId,
      changedFields: changedMutationFields(body, null, row),
      subject: "product option unit",
      actionName: "product.option_unit.create",
      routeOrToolName: "products.option_unit.create",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: option.productId, axis: "option" })
    return c.json({ data: row }, 201)
  })
  .openapi(updateUnitRoute, async (c) => {
    const unitId = c.req.valid("param").unitId
    const body = c.req.valid("json")
    const before = await productsService.getUnitForProductMutation(c.get("db"), unitId)
    if (!before) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    const row = await productsService.updateUnit(c.get("db"), unitId, body)

    if (!row) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "update",
      productId: before.productId,
      changedFields: changedMutationFields(body, before, row),
      subject: "product option unit",
      actionName: "product.option_unit.update",
      routeOrToolName: "products.option_unit.update",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "option" })
    return c.json({ data: row }, 200)
  })
  .openapi(deleteUnitRoute, async (c) => {
    const unitId = c.req.valid("param").unitId
    const before = await productsService.getUnitForProductMutation(c.get("db"), unitId)
    if (!before) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    const row = await productsService.deleteUnit(c.get("db"), unitId)

    if (!row) {
      return c.json({ error: "Option unit not found" }, 404)
    }

    await appendProductMutationLedgerEntry(c, {
      action: "delete",
      productId: before.productId,
      changedFields: [],
      subject: "product option unit",
      actionName: "product.option_unit.delete",
      routeOrToolName: "products.option_unit.delete",
    })
    await emitProductContentChanged(c.get("eventBus"), { id: before.productId, axis: "option" })
    return c.json({ success: true }, 200)
  })

// Mount the options and units child sub-chains on the options parent. Static
// collection paths are registered inside each child before its dynamic legs.
export const productOptionRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .route("/", optionRoutes)
  .route("/", unitRoutes)

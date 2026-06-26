/**
 * Admin routes for inventory extras — a separately, independently mounted
 * surface (`inventoryExtrasRoutes`) composed into the framework's combined
 * "extras" `OpenAPIHono` module. Covers two resource sub-chains: product-extras
 * CRUD and option-extra-configs CRUD.
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * inventory extras sub-batch, the last inventory batch). Request schemas reuse
 * the existing `validation.ts` schemas the handlers already parse; the list
 * endpoints use the framework's canonical `listResponseSchema(...)` envelope;
 * response row schemas are authored from the Drizzle `$inferSelect` shapes in
 * `schema.ts` (§17: timestamp columns serialize to ISO strings over the wire,
 * integer columns stay numbers). Business logic + service wiring are unchanged;
 * handlers read `c.req.valid(...)`.
 *
 * The routes are split into per-resource child `OpenAPIHono` sub-chains
 * (`.route("/", child)`) rather than one long flat `.openapi()` chain to keep
 * the tsc inference cost linear. Within each child, the static collection paths
 * are registered before the dynamic `/{id}` legs.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { inventoryExtrasService } from "./service.js"
import {
  extraCollectionModeSchema,
  extraPricingModeSchema,
  extraSelectionTypeSchema,
  insertOptionExtraConfigSchema,
  insertProductExtraSchema,
  optionExtraConfigListQuerySchema,
  productExtraListQuerySchema,
  updateOptionExtraConfigSchema,
  updateProductExtraSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
  }
}

// --- shared response building blocks ---------------------------------------
// Authored from the Drizzle `$inferSelect` shapes; §17: timestamp columns are
// ISO strings on the wire.

const isoTimestamp = z.string()
const errorResponseSchema = z.object({ error: z.string() })
const deleteResponseSchema = z.object({ success: z.boolean() })
const idParamSchema = z.object({ id: z.string() })
const jsonObject = z.record(z.string(), z.unknown())

// --- row response schemas (from $inferSelect) ------------------------------

const productExtraSchema = z.object({
  id: z.string(),
  productId: z.string(),
  supplierId: z.string().nullable(),
  code: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  selectionType: extraSelectionTypeSchema,
  pricingMode: extraPricingModeSchema,
  pricedPerPerson: z.boolean(),
  collectionMode: extraCollectionModeSchema,
  showOnSlotManifest: z.boolean(),
  minQuantity: z.number().int().nullable(),
  maxQuantity: z.number().int().nullable(),
  defaultQuantity: z.number().int().nullable(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  metadata: jsonObject.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const optionExtraConfigSchema = z.object({
  id: z.string(),
  optionId: z.string(),
  productExtraId: z.string(),
  selectionType: extraSelectionTypeSchema.nullable(),
  pricingMode: extraPricingModeSchema.nullable(),
  pricedPerPerson: z.boolean().nullable(),
  minQuantity: z.number().int().nullable(),
  maxQuantity: z.number().int().nullable(),
  defaultQuantity: z.number().int().nullable(),
  isDefault: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  notes: z.string().nullable(),
  metadata: jsonObject.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// --- helpers ---------------------------------------------------------------

function jsonBody<S extends z.ZodTypeAny>(schema: S, required: boolean, description: string) {
  return {
    required,
    description,
    content: { "application/json": { schema } },
  }
}

function dataResponse<S extends z.ZodTypeAny>(schema: S, description: string) {
  return {
    description,
    content: { "application/json": { schema: z.object({ data: schema }) } },
  }
}

function listResponse<S extends z.ZodTypeAny>(schema: S, description: string) {
  return {
    description,
    content: { "application/json": { schema: listResponseSchema(schema) } },
  }
}

function notFoundResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: errorResponseSchema } },
  }
}

function deletedResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: deleteResponseSchema } },
  }
}

const invalidRequestResponse = {
  description: "invalid_request — request input failed validation",
  content: { "application/json": { schema: errorResponseSchema } },
}

// --- product-extras sub-chain ----------------------------------------------

const listProductExtrasRoute = createRoute({
  method: "get",
  path: "/product-extras",
  request: { query: productExtraListQuerySchema },
  responses: {
    200: listResponse(productExtraSchema, "Paginated product extras"),
    400: invalidRequestResponse,
  },
})

const createProductExtraRoute = createRoute({
  method: "post",
  path: "/product-extras",
  request: { body: jsonBody(insertProductExtraSchema, true, "Product extra") },
  responses: {
    201: dataResponse(productExtraSchema, "The created product extra"),
    400: invalidRequestResponse,
  },
})

const getProductExtraRoute = createRoute({
  method: "get",
  path: "/product-extras/{id}",
  request: { params: idParamSchema },
  responses: {
    200: dataResponse(productExtraSchema, "A product extra by id"),
    404: notFoundResponse("Product extra not found"),
  },
})

const updateProductExtraRoute = createRoute({
  method: "patch",
  path: "/product-extras/{id}",
  request: {
    params: idParamSchema,
    body: jsonBody(updateProductExtraSchema, false, "Partial product extra update"),
  },
  responses: {
    200: dataResponse(productExtraSchema, "The updated product extra"),
    400: invalidRequestResponse,
    404: notFoundResponse("Product extra not found"),
  },
})

const deleteProductExtraRoute = createRoute({
  method: "delete",
  path: "/product-extras/{id}",
  request: { params: idParamSchema },
  responses: {
    200: deletedResponse("The product extra was deleted"),
    404: notFoundResponse("Product extra not found"),
  },
})

const productExtrasRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listProductExtrasRoute, async (c) => {
    return c.json(
      await inventoryExtrasService.listProductExtras(c.get("db"), c.req.valid("query")),
      200,
    )
  })
  .openapi(createProductExtraRoute, async (c) => {
    const row = await inventoryExtrasService.createProductExtra(c.get("db"), c.req.valid("json"))
    if (!row) throw new Error("Failed to create product extra")
    return c.json({ data: row }, 201)
  })
  .openapi(getProductExtraRoute, async (c) => {
    const row = await inventoryExtrasService.getProductExtraById(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Product extra not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(updateProductExtraRoute, async (c) => {
    const row = await inventoryExtrasService.updateProductExtra(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "Product extra not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(deleteProductExtraRoute, async (c) => {
    const row = await inventoryExtrasService.deleteProductExtra(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Product extra not found" }, 404)
    return c.json({ success: true }, 200)
  })

// --- option-extra-configs sub-chain ----------------------------------------

const listOptionExtraConfigsRoute = createRoute({
  method: "get",
  path: "/option-extra-configs",
  request: { query: optionExtraConfigListQuerySchema },
  responses: {
    200: listResponse(optionExtraConfigSchema, "Paginated option extra configs"),
    400: invalidRequestResponse,
  },
})

const createOptionExtraConfigRoute = createRoute({
  method: "post",
  path: "/option-extra-configs",
  request: { body: jsonBody(insertOptionExtraConfigSchema, true, "Option extra config") },
  responses: {
    201: dataResponse(optionExtraConfigSchema, "The created option extra config"),
    400: invalidRequestResponse,
  },
})

const getOptionExtraConfigRoute = createRoute({
  method: "get",
  path: "/option-extra-configs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: dataResponse(optionExtraConfigSchema, "An option extra config by id"),
    404: notFoundResponse("Option extra config not found"),
  },
})

const updateOptionExtraConfigRoute = createRoute({
  method: "patch",
  path: "/option-extra-configs/{id}",
  request: {
    params: idParamSchema,
    body: jsonBody(updateOptionExtraConfigSchema, false, "Partial option extra config update"),
  },
  responses: {
    200: dataResponse(optionExtraConfigSchema, "The updated option extra config"),
    400: invalidRequestResponse,
    404: notFoundResponse("Option extra config not found"),
  },
})

const deleteOptionExtraConfigRoute = createRoute({
  method: "delete",
  path: "/option-extra-configs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: deletedResponse("The option extra config was deleted"),
    404: notFoundResponse("Option extra config not found"),
  },
})

const optionExtraConfigsRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listOptionExtraConfigsRoute, async (c) => {
    return c.json(
      await inventoryExtrasService.listOptionExtraConfigs(c.get("db"), c.req.valid("query")),
      200,
    )
  })
  .openapi(createOptionExtraConfigRoute, async (c) => {
    const row = await inventoryExtrasService.createOptionExtraConfig(
      c.get("db"),
      c.req.valid("json"),
    )
    if (!row) throw new Error("Failed to create option extra config")
    return c.json({ data: row }, 201)
  })
  .openapi(getOptionExtraConfigRoute, async (c) => {
    const row = await inventoryExtrasService.getOptionExtraConfigById(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Option extra config not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(updateOptionExtraConfigRoute, async (c) => {
    const row = await inventoryExtrasService.updateOptionExtraConfig(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "Option extra config not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(deleteOptionExtraConfigRoute, async (c) => {
    const row = await inventoryExtrasService.deleteOptionExtraConfig(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Option extra config not found" }, 404)
    return c.json({ success: true }, 200)
  })

export const inventoryExtrasRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})
  .route("/", productExtrasRoutes)
  .route("/", optionExtraConfigsRoutes)

export type InventoryExtrasRoutes = typeof inventoryExtrasRoutes

export const __test__ = {
  productExtraSchema,
  optionExtraConfigSchema,
}

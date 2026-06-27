/**
 * Relationships "custom fields" admin routes — custom-field definitions plus the
 * unified value API (values live on each entity's `custom_fields` jsonb; the
 * value rows are synthetic — see the custom-fields unification ADR). Migrated to
 * `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2276 — step 3.5,
 * stage B). Request schemas reuse the exported `validation.ts` schemas; response
 * row schemas live in `rest-openapi-schemas.ts`. Handlers read `c.req.valid(...)`
 * and still call the same `relationshipsService` methods via `c.get("db")`. Each
 * route is registered statement-style to keep type-inference cost bounded.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { relationshipsService } from "../service/index.js"
import {
  customFieldDefinitionListQuerySchema,
  customFieldValueListQuerySchema,
  insertCustomFieldDefinitionSchema,
  updateCustomFieldDefinitionSchema,
  upsertCustomFieldValueSchema,
} from "../validation.js"
import {
  customFieldDefinitionSchema,
  customFieldValueSchema,
  errorResponseSchema,
  idParamSchema,
  successResponseSchema,
} from "./rest-openapi-schemas.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

const jsonContent = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { "application/json": { schema } },
})

const requiredJsonBody = <T extends z.ZodTypeAny>(schema: T) => ({
  body: { required: true, content: { "application/json": { schema } } },
})

const listCustomFieldsRoute = createRoute({
  method: "get",
  path: "/custom-fields",
  request: { query: customFieldDefinitionListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of custom-field definitions",
      ...jsonContent(listResponseSchema(customFieldDefinitionSchema)),
    },
  },
})

const createCustomFieldRoute = createRoute({
  method: "post",
  path: "/custom-fields",
  request: requiredJsonBody(insertCustomFieldDefinitionSchema),
  responses: {
    201: {
      description: "The created custom-field definition",
      ...jsonContent(z.object({ data: customFieldDefinitionSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getCustomFieldRoute = createRoute({
  method: "get",
  path: "/custom-fields/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A custom-field definition by id",
      ...jsonContent(z.object({ data: customFieldDefinitionSchema })),
    },
    404: { description: "Custom field not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateCustomFieldRoute = createRoute({
  method: "patch",
  path: "/custom-fields/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateCustomFieldDefinitionSchema) },
  responses: {
    200: {
      description: "The updated custom-field definition",
      ...jsonContent(z.object({ data: customFieldDefinitionSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Custom field not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteCustomFieldRoute = createRoute({
  method: "delete",
  path: "/custom-fields/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Custom field deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Custom field not found", ...jsonContent(errorResponseSchema) },
  },
})

const listCustomFieldValuesRoute = createRoute({
  method: "get",
  path: "/custom-field-values",
  request: { query: customFieldValueListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of custom-field values",
      ...jsonContent(listResponseSchema(customFieldValueSchema)),
    },
  },
})

const upsertCustomFieldValueRoute = createRoute({
  method: "put",
  path: "/custom-fields/{id}/value",
  request: { params: idParamSchema, ...requiredJsonBody(upsertCustomFieldValueSchema) },
  responses: {
    200: {
      description: "The upserted custom-field value",
      ...jsonContent(z.object({ data: customFieldValueSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const deleteCustomFieldValueRoute = createRoute({
  method: "delete",
  path: "/custom-field-values/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Custom field value deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Custom field value not found", ...jsonContent(errorResponseSchema) },
  },
})

export const customFieldRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })

customFieldRoutes.openapi(listCustomFieldsRoute, async (c) =>
  c.json(
    await relationshipsService.listCustomFieldDefinitions(c.get("db"), c.req.valid("query")),
    200,
  ),
)
customFieldRoutes.openapi(createCustomFieldRoute, async (c) => {
  const row = await relationshipsService.createCustomFieldDefinition(
    c.get("db"),
    c.req.valid("json"),
  )
  return c.json({ data: row! }, 201)
})
customFieldRoutes.openapi(getCustomFieldRoute, async (c) => {
  const row = await relationshipsService.getCustomFieldDefinitionById(
    c.get("db"),
    c.req.valid("param").id,
  )
  return row ? c.json({ data: row }, 200) : c.json({ error: "Custom field not found" }, 404)
})
customFieldRoutes.openapi(updateCustomFieldRoute, async (c) => {
  const row = await relationshipsService.updateCustomFieldDefinition(
    c.get("db"),
    c.req.valid("param").id,
    c.req.valid("json"),
  )
  return row ? c.json({ data: row }, 200) : c.json({ error: "Custom field not found" }, 404)
})
customFieldRoutes.openapi(deleteCustomFieldRoute, async (c) => {
  const row = await relationshipsService.deleteCustomFieldDefinition(
    c.get("db"),
    c.req.valid("param").id,
  )
  return row
    ? c.json({ success: true } as const, 200)
    : c.json({ error: "Custom field not found" }, 404)
})
customFieldRoutes.openapi(listCustomFieldValuesRoute, async (c) =>
  c.json(await relationshipsService.listCustomFieldValues(c.get("db"), c.req.valid("query")), 200),
)
customFieldRoutes.openapi(upsertCustomFieldValueRoute, async (c) =>
  c.json(
    {
      data: await relationshipsService.upsertCustomFieldValue(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      ),
    },
    200,
  ),
)
customFieldRoutes.openapi(deleteCustomFieldValueRoute, async (c) => {
  const row = await relationshipsService.deleteCustomFieldValue(
    c.get("db"),
    c.req.valid("param").id,
  )
  return row
    ? c.json({ success: true } as const, 200)
    : c.json({ error: "Custom field value not found" }, 404)
})

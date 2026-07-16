/**
 * Entity-owned value routes resolve definitions by their durable namespace
 * identity and persist only `custom_fields[namespace][key]`.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { relationshipsService } from "../service/index.js"
import { customFieldValueListQuerySchema, upsertCustomFieldValueSchema } from "../validation.js"
import {
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

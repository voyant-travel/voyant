/**
 * Relationships "customer signals" admin routes — lightweight pre-pipeline
 * interest records (wishlist / notify / inquiry / request-offer / referral) plus
 * resolution to a booking. Migrated to `@hono/zod-openapi` for the OpenAPI admin
 * backfill (voyant#2276 — step 3.5, stage B). Request schemas reuse the exported
 * `validation.ts` schemas; response row schemas live in
 * `rest-openapi-schemas.ts`. Handlers read `c.req.valid(...)` and still call the
 * same `relationshipsService` methods via `c.get("db")`. Each route is
 * registered statement-style to keep type-inference cost bounded.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { relationshipsService } from "../service/index.js"
import {
  customerSignalListQuerySchema,
  insertCustomerSignalSchema,
  resolveCustomerSignalSchema,
  updateCustomerSignalSchema,
} from "../validation.js"
import {
  customerSignalSchema,
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

const listCustomerSignalsRoute = createRoute({
  method: "get",
  path: "/customer-signals",
  request: { query: customerSignalListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of customer signals",
      ...jsonContent(listResponseSchema(customerSignalSchema)),
    },
  },
})

const createCustomerSignalRoute = createRoute({
  method: "post",
  path: "/customer-signals",
  request: requiredJsonBody(insertCustomerSignalSchema),
  responses: {
    201: {
      description: "The created customer signal",
      ...jsonContent(z.object({ data: customerSignalSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Person not found", ...jsonContent(errorResponseSchema) },
  },
})

const getCustomerSignalRoute = createRoute({
  method: "get",
  path: "/customer-signals/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A customer signal by id",
      ...jsonContent(z.object({ data: customerSignalSchema })),
    },
    404: { description: "Signal not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateCustomerSignalRoute = createRoute({
  method: "patch",
  path: "/customer-signals/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateCustomerSignalSchema) },
  responses: {
    200: {
      description: "The updated customer signal",
      ...jsonContent(z.object({ data: customerSignalSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Signal not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteCustomerSignalRoute = createRoute({
  method: "delete",
  path: "/customer-signals/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Signal deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Signal not found", ...jsonContent(errorResponseSchema) },
  },
})

const resolveCustomerSignalRoute = createRoute({
  method: "post",
  path: "/customer-signals/{id}/resolve",
  request: { params: idParamSchema, ...requiredJsonBody(resolveCustomerSignalSchema) },
  responses: {
    200: {
      description: "The resolved (converted) customer signal",
      ...jsonContent(z.object({ data: customerSignalSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Signal not found", ...jsonContent(errorResponseSchema) },
  },
})

const listPersonSignalsRoute = createRoute({
  method: "get",
  path: "/people/{id}/signals",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Customer signals for the person",
      ...jsonContent(z.object({ data: z.array(customerSignalSchema) })),
    },
  },
})

export const customerSignalRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })

customerSignalRoutes.openapi(listCustomerSignalsRoute, async (c) =>
  c.json(await relationshipsService.listCustomerSignals(c.get("db"), c.req.valid("query")), 200),
)
customerSignalRoutes.openapi(createCustomerSignalRoute, async (c) => {
  const row = await relationshipsService.createCustomerSignal(c.get("db"), c.req.valid("json"))
  return row ? c.json({ data: row }, 201) : c.json({ error: "Person not found" }, 404)
})
customerSignalRoutes.openapi(getCustomerSignalRoute, async (c) => {
  const row = await relationshipsService.getCustomerSignal(c.get("db"), c.req.valid("param").id)
  return row ? c.json({ data: row }, 200) : c.json({ error: "Signal not found" }, 404)
})
customerSignalRoutes.openapi(updateCustomerSignalRoute, async (c) => {
  const row = await relationshipsService.updateCustomerSignal(
    c.get("db"),
    c.req.valid("param").id,
    c.req.valid("json"),
  )
  return row ? c.json({ data: row }, 200) : c.json({ error: "Signal not found" }, 404)
})
customerSignalRoutes.openapi(deleteCustomerSignalRoute, async (c) => {
  const row = await relationshipsService.deleteCustomerSignal(c.get("db"), c.req.valid("param").id)
  return row ? c.json({ success: true } as const, 200) : c.json({ error: "Signal not found" }, 404)
})
customerSignalRoutes.openapi(resolveCustomerSignalRoute, async (c) => {
  const body = c.req.valid("json")
  const row = await relationshipsService.resolveCustomerSignalToBooking(
    c.get("db"),
    c.req.valid("param").id,
    body.bookingId,
  )
  return row ? c.json({ data: row }, 200) : c.json({ error: "Signal not found" }, 404)
})
customerSignalRoutes.openapi(listPersonSignalsRoute, async (c) =>
  c.json(
    { data: await relationshipsService.listSignalsForPerson(c.get("db"), c.req.valid("param").id) },
    200,
  ),
)

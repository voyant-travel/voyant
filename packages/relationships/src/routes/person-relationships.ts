/**
 * Relationships "person relationships" admin routes — directed person-to-person
 * edges (kinship, emergency contacts, travel companions). Migrated to
 * `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2276 — step 3.5,
 * stage B). Request schemas reuse the exported `validation.ts` schemas; response
 * row schemas live in `rest-openapi-schemas.ts`. Handlers read `c.req.valid(...)`
 * and still call the same `relationshipsService` methods via `c.get("db")`. Each
 * route is registered statement-style to keep type-inference cost bounded.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { relationshipsService } from "../service/index.js"
import {
  insertPersonRelationshipSchema,
  personRelationshipListQuerySchema,
  updatePersonRelationshipSchema,
} from "../validation.js"
import {
  errorResponseSchema,
  idParamSchema,
  personRelationshipSchema,
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

const listPersonRelationshipsRoute = createRoute({
  method: "get",
  path: "/people/{id}/relationships",
  request: { params: idParamSchema, query: personRelationshipListQuerySchema },
  responses: {
    200: {
      description: "Relationships for the person",
      ...jsonContent(z.object({ data: z.array(personRelationshipSchema) })),
    },
  },
})

const createPersonRelationshipRoute = createRoute({
  method: "post",
  path: "/people/{id}/relationships",
  request: { params: idParamSchema, ...requiredJsonBody(insertPersonRelationshipSchema) },
  responses: {
    201: {
      description: "The created relationship edge",
      ...jsonContent(z.object({ data: personRelationshipSchema })),
    },
    400: {
      description: "invalid_request, person not found, or self-relationship rejected",
      ...jsonContent(errorResponseSchema),
    },
    409: { description: "Relationship already exists", ...jsonContent(errorResponseSchema) },
  },
})

const getPersonRelationshipRoute = createRoute({
  method: "get",
  path: "/person-relationships/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A relationship edge by id",
      ...jsonContent(z.object({ data: personRelationshipSchema })),
    },
    404: { description: "Relationship not found", ...jsonContent(errorResponseSchema) },
  },
})

const updatePersonRelationshipRoute = createRoute({
  method: "patch",
  path: "/person-relationships/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updatePersonRelationshipSchema) },
  responses: {
    200: {
      description: "The updated relationship edge",
      ...jsonContent(z.object({ data: personRelationshipSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Relationship not found", ...jsonContent(errorResponseSchema) },
  },
})

const deletePersonRelationshipRoute = createRoute({
  method: "delete",
  path: "/person-relationships/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Relationship deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Relationship not found", ...jsonContent(errorResponseSchema) },
  },
})

export const personRelationshipRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})

personRelationshipRoutes.openapi(listPersonRelationshipsRoute, async (c) =>
  c.json(
    {
      data: await relationshipsService.listPersonRelationships(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("query"),
      ),
    },
    200,
  ),
)
personRelationshipRoutes.openapi(createPersonRelationshipRoute, async (c) => {
  const row = await relationshipsService.createPersonRelationship(
    c.get("db"),
    c.req.valid("param").id,
    c.req.valid("json"),
  )
  return row
    ? c.json({ data: row }, 201)
    : c.json({ error: "Person not found or self-relationship rejected" }, 400)
})
personRelationshipRoutes.openapi(getPersonRelationshipRoute, async (c) => {
  const row = await relationshipsService.getPersonRelationship(c.get("db"), c.req.valid("param").id)
  return row ? c.json({ data: row }, 200) : c.json({ error: "Relationship not found" }, 404)
})
personRelationshipRoutes.openapi(updatePersonRelationshipRoute, async (c) => {
  const row = await relationshipsService.updatePersonRelationship(
    c.get("db"),
    c.req.valid("param").id,
    c.req.valid("json"),
  )
  return row ? c.json({ data: row }, 200) : c.json({ error: "Relationship not found" }, 404)
})
personRelationshipRoutes.openapi(deletePersonRelationshipRoute, async (c) => {
  const row = await relationshipsService.deletePersonRelationship(
    c.get("db"),
    c.req.valid("param").id,
  )
  return row
    ? c.json({ success: true } as const, 200)
    : c.json({ error: "Relationship not found" }, 404)
})

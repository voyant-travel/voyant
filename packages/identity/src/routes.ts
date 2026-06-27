/**
 * Identity admin routes — contact points, postal addresses, and named contacts
 * (CRUD + the entity-scoped list/create legs under `/entities/{entityType}/
 * {entityId}/...`).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 —
 * identity sub-batch) via a NON-BREAKING dual-mount: the same `OpenAPIHono`
 * instance is exported as `identityRoutes` and mounted by the framework on BOTH
 * the legacy `/v1/identity/*` surface (the dashboard still calls those paths)
 * AND the documented staff surface at `/v1/admin/identity/*` (see `index.ts`).
 * Request schemas reuse the exported `validation.ts` insert/update/list-query
 * schemas the handlers already parsed; response row schemas live in
 * `routes/openapi-schemas.ts` (authored from the Drizzle `$inferSelect` shapes;
 * §17 timestamps → strings). Business logic, primary-flag enforcement, and the
 * wire envelopes (`{ data, total, limit, offset }` lists, `{ data }` singles,
 * `{ success: true }` deletes) are unchanged; handlers read `c.req.valid(...)`.
 *
 * Each resource family is its own small `OpenAPIHono` sub-chain composed onto
 * the parent via `.route("/")` so the `.openapi()` operations propagate up while
 * keeping type-inference cost bounded (one flat chain has O(n²) inference cost).
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"

import type { IdentityRouteEnv } from "./routes/env.js"
import {
  addressSchema,
  contactPointSchema,
  entityParamSchema,
  errorResponseSchema,
  idParamSchema,
  namedContactSchema,
  successResponseSchema,
} from "./routes/openapi-schemas.js"
import { identityService } from "./service.js"
import {
  addressListQuerySchema,
  contactPointListQuerySchema,
  insertAddressForEntitySchema,
  insertAddressSchema,
  insertContactPointForEntitySchema,
  insertContactPointSchema,
  insertNamedContactForEntitySchema,
  insertNamedContactSchema,
  namedContactListQuerySchema,
  updateAddressSchema,
  updateContactPointSchema,
  updateNamedContactSchema,
} from "./validation.js"

const jsonContent = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { "application/json": { schema } },
})

const requiredJsonBody = <T extends z.ZodTypeAny>(schema: T) => ({
  body: { required: true, content: { "application/json": { schema } } },
})

// --- contact points ---------------------------------------------------------

const listContactPointsRoute = createRoute({
  method: "get",
  path: "/contact-points",
  tags: ["Identity"],
  summary: "List contact points",
  request: { query: contactPointListQuerySchema },
  responses: {
    200: {
      description: "Paginated contact points",
      ...jsonContent(listResponseSchema(contactPointSchema)),
    },
  },
})

const createContactPointRoute = createRoute({
  method: "post",
  path: "/contact-points",
  tags: ["Identity"],
  summary: "Create a contact point",
  request: requiredJsonBody(insertContactPointSchema),
  responses: {
    201: {
      description: "The created contact point",
      ...jsonContent(z.object({ data: contactPointSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getContactPointRoute = createRoute({
  method: "get",
  path: "/contact-points/{id}",
  tags: ["Identity"],
  summary: "Get a contact point by id",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A contact point by id",
      ...jsonContent(z.object({ data: contactPointSchema })),
    },
    404: { description: "Contact point not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateContactPointRoute = createRoute({
  method: "patch",
  path: "/contact-points/{id}",
  tags: ["Identity"],
  summary: "Update a contact point",
  request: { params: idParamSchema, ...requiredJsonBody(updateContactPointSchema) },
  responses: {
    200: {
      description: "The updated contact point",
      ...jsonContent(z.object({ data: contactPointSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Contact point not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteContactPointRoute = createRoute({
  method: "delete",
  path: "/contact-points/{id}",
  tags: ["Identity"],
  summary: "Delete a contact point",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Contact point deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Contact point not found", ...jsonContent(errorResponseSchema) },
  },
})

const contactPointRoutes = new OpenAPIHono<IdentityRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listContactPointsRoute, async (c) =>
    c.json(await identityService.listContactPoints(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createContactPointRoute, async (c) => {
    const row = await identityService.createContactPoint(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getContactPointRoute, async (c) => {
    const row = await identityService.getContactPointById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Contact point not found" }, 404)
  })
  .openapi(updateContactPointRoute, async (c) => {
    const row = await identityService.updateContactPoint(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Contact point not found" }, 404)
  })
  .openapi(deleteContactPointRoute, async (c) => {
    const row = await identityService.deleteContactPoint(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Contact point not found" }, 404)
  })

// --- addresses --------------------------------------------------------------

const listAddressesRoute = createRoute({
  method: "get",
  path: "/addresses",
  tags: ["Identity"],
  summary: "List addresses",
  request: { query: addressListQuerySchema },
  responses: {
    200: {
      description: "Paginated addresses",
      ...jsonContent(listResponseSchema(addressSchema)),
    },
  },
})

const createAddressRoute = createRoute({
  method: "post",
  path: "/addresses",
  tags: ["Identity"],
  summary: "Create an address",
  request: requiredJsonBody(insertAddressSchema),
  responses: {
    201: {
      description: "The created address",
      ...jsonContent(z.object({ data: addressSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getAddressRoute = createRoute({
  method: "get",
  path: "/addresses/{id}",
  tags: ["Identity"],
  summary: "Get an address by id",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An address by id",
      ...jsonContent(z.object({ data: addressSchema })),
    },
    404: { description: "Address not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateAddressRoute = createRoute({
  method: "patch",
  path: "/addresses/{id}",
  tags: ["Identity"],
  summary: "Update an address",
  request: { params: idParamSchema, ...requiredJsonBody(updateAddressSchema) },
  responses: {
    200: {
      description: "The updated address",
      ...jsonContent(z.object({ data: addressSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Address not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteAddressRoute = createRoute({
  method: "delete",
  path: "/addresses/{id}",
  tags: ["Identity"],
  summary: "Delete an address",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Address deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Address not found", ...jsonContent(errorResponseSchema) },
  },
})

const addressRoutes = new OpenAPIHono<IdentityRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listAddressesRoute, async (c) =>
    c.json(await identityService.listAddresses(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createAddressRoute, async (c) => {
    const row = await identityService.createAddress(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getAddressRoute, async (c) => {
    const row = await identityService.getAddressById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Address not found" }, 404)
  })
  .openapi(updateAddressRoute, async (c) => {
    const row = await identityService.updateAddress(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Address not found" }, 404)
  })
  .openapi(deleteAddressRoute, async (c) => {
    const row = await identityService.deleteAddress(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Address not found" }, 404)
  })

// --- named contacts ---------------------------------------------------------

const listNamedContactsRoute = createRoute({
  method: "get",
  path: "/named-contacts",
  tags: ["Identity"],
  summary: "List named contacts",
  request: { query: namedContactListQuerySchema },
  responses: {
    200: {
      description: "Paginated named contacts",
      ...jsonContent(listResponseSchema(namedContactSchema)),
    },
  },
})

const createNamedContactRoute = createRoute({
  method: "post",
  path: "/named-contacts",
  tags: ["Identity"],
  summary: "Create a named contact",
  request: requiredJsonBody(insertNamedContactSchema),
  responses: {
    201: {
      description: "The created named contact",
      ...jsonContent(z.object({ data: namedContactSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const getNamedContactRoute = createRoute({
  method: "get",
  path: "/named-contacts/{id}",
  tags: ["Identity"],
  summary: "Get a named contact by id",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A named contact by id",
      ...jsonContent(z.object({ data: namedContactSchema })),
    },
    404: { description: "Named contact not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateNamedContactRoute = createRoute({
  method: "patch",
  path: "/named-contacts/{id}",
  tags: ["Identity"],
  summary: "Update a named contact",
  request: { params: idParamSchema, ...requiredJsonBody(updateNamedContactSchema) },
  responses: {
    200: {
      description: "The updated named contact",
      ...jsonContent(z.object({ data: namedContactSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Named contact not found", ...jsonContent(errorResponseSchema) },
  },
})

const deleteNamedContactRoute = createRoute({
  method: "delete",
  path: "/named-contacts/{id}",
  tags: ["Identity"],
  summary: "Delete a named contact",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Named contact deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Named contact not found", ...jsonContent(errorResponseSchema) },
  },
})

const namedContactRoutes = new OpenAPIHono<IdentityRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listNamedContactsRoute, async (c) =>
    c.json(await identityService.listNamedContacts(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createNamedContactRoute, async (c) => {
    const row = await identityService.createNamedContact(c.get("db"), c.req.valid("json"))
    return c.json({ data: row! }, 201)
  })
  .openapi(getNamedContactRoute, async (c) => {
    const row = await identityService.getNamedContactById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Named contact not found" }, 404)
  })
  .openapi(updateNamedContactRoute, async (c) => {
    const row = await identityService.updateNamedContact(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Named contact not found" }, 404)
  })
  .openapi(deleteNamedContactRoute, async (c) => {
    const row = await identityService.deleteNamedContact(c.get("db"), c.req.valid("param").id)
    return row
      ? c.json({ success: true } as const, 200)
      : c.json({ error: "Named contact not found" }, 404)
  })

// --- entity-scoped list/create legs -----------------------------------------

const listEntityContactPointsRoute = createRoute({
  method: "get",
  path: "/entities/{entityType}/{entityId}/contact-points",
  tags: ["Identity"],
  summary: "List contact points for an entity",
  request: { params: entityParamSchema },
  responses: {
    200: {
      description: "Contact points for an entity",
      ...jsonContent(z.object({ data: z.array(contactPointSchema) })),
    },
  },
})

const createEntityContactPointRoute = createRoute({
  method: "post",
  path: "/entities/{entityType}/{entityId}/contact-points",
  tags: ["Identity"],
  summary: "Create a contact point for an entity",
  request: { params: entityParamSchema, ...requiredJsonBody(insertContactPointForEntitySchema) },
  responses: {
    201: {
      description: "The created contact point",
      ...jsonContent(z.object({ data: contactPointSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const listEntityAddressesRoute = createRoute({
  method: "get",
  path: "/entities/{entityType}/{entityId}/addresses",
  tags: ["Identity"],
  summary: "List addresses for an entity",
  request: { params: entityParamSchema },
  responses: {
    200: {
      description: "Addresses for an entity",
      ...jsonContent(z.object({ data: z.array(addressSchema) })),
    },
  },
})

const createEntityAddressRoute = createRoute({
  method: "post",
  path: "/entities/{entityType}/{entityId}/addresses",
  tags: ["Identity"],
  summary: "Create an address for an entity",
  request: { params: entityParamSchema, ...requiredJsonBody(insertAddressForEntitySchema) },
  responses: {
    201: {
      description: "The created address",
      ...jsonContent(z.object({ data: addressSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const listEntityNamedContactsRoute = createRoute({
  method: "get",
  path: "/entities/{entityType}/{entityId}/named-contacts",
  tags: ["Identity"],
  summary: "List named contacts for an entity",
  request: { params: entityParamSchema },
  responses: {
    200: {
      description: "Named contacts for an entity",
      ...jsonContent(z.object({ data: z.array(namedContactSchema) })),
    },
  },
})

const createEntityNamedContactRoute = createRoute({
  method: "post",
  path: "/entities/{entityType}/{entityId}/named-contacts",
  tags: ["Identity"],
  summary: "Create a named contact for an entity",
  request: { params: entityParamSchema, ...requiredJsonBody(insertNamedContactForEntitySchema) },
  responses: {
    201: {
      description: "The created named contact",
      ...jsonContent(z.object({ data: namedContactSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
  },
})

const entityRoutes = new OpenAPIHono<IdentityRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .openapi(listEntityContactPointsRoute, async (c) => {
    const { entityType, entityId } = c.req.valid("param")
    return c.json(
      { data: await identityService.listContactPointsForEntity(c.get("db"), entityType, entityId) },
      200,
    )
  })
  .openapi(createEntityContactPointRoute, async (c) => {
    const { entityType, entityId } = c.req.valid("param")
    const row = await identityService.createContactPoint(c.get("db"), {
      ...c.req.valid("json"),
      entityType,
      entityId,
    })
    return c.json({ data: row! }, 201)
  })
  .openapi(listEntityAddressesRoute, async (c) => {
    const { entityType, entityId } = c.req.valid("param")
    return c.json(
      { data: await identityService.listAddressesForEntity(c.get("db"), entityType, entityId) },
      200,
    )
  })
  .openapi(createEntityAddressRoute, async (c) => {
    const { entityType, entityId } = c.req.valid("param")
    const row = await identityService.createAddress(c.get("db"), {
      ...c.req.valid("json"),
      entityType,
      entityId,
    })
    return c.json({ data: row! }, 201)
  })
  .openapi(listEntityNamedContactsRoute, async (c) => {
    const { entityType, entityId } = c.req.valid("param")
    return c.json(
      { data: await identityService.listNamedContactsForEntity(c.get("db"), entityType, entityId) },
      200,
    )
  })
  .openapi(createEntityNamedContactRoute, async (c) => {
    const { entityType, entityId } = c.req.valid("param")
    const row = await identityService.createNamedContact(c.get("db"), {
      ...c.req.valid("json"),
      entityType,
      entityId,
    })
    return c.json({ data: row! }, 201)
  })

export const identityRoutes = new OpenAPIHono<IdentityRouteEnv>({
  defaultHook: openApiValidationHook,
})
  .route("/", contactPointRoutes)
  .route("/", addressRoutes)
  .route("/", namedContactRoutes)
  .route("/", entityRoutes)

export type IdentityRoutes = typeof identityRoutes

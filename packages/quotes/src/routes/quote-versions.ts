import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook, parseOptionalJsonBody } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { quotesService } from "../service/index.js"
import {
  QuoteVersionConflictError,
  QuoteVersionParentNotFoundError,
} from "../service/quote-versions.js"
import {
  acceptQuoteVersionSchema,
  applyTripSnapshotToQuoteVersionSchema,
  declineQuoteVersionSchema,
  expireQuoteVersionsSchema,
  insertQuoteVersionLineSchema,
  insertQuoteVersionSchema,
  quoteVersionListQuerySchema,
  sendQuoteVersionSchema,
  updateQuoteVersionLineSchema,
  updateQuoteVersionSchema,
} from "../validation.js"
import {
  acceptQuoteVersionResultSchema,
  applyTripSnapshotResultSchema,
  errorResponseSchema,
  idParamSchema,
  quoteVersionLineSchema,
  quoteVersionSchema,
  successResponseSchema,
} from "./openapi-schemas.js"

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

const validityBodySchema = z.object({ validUntil: z.string().date().nullable() })

// --- versions: core CRUD + lifecycle entry points ---------------------------

const listQuoteVersionsRoute = createRoute({
  method: "get",
  path: "/quote-versions",
  request: { query: quoteVersionListQuerySchema },
  responses: {
    200: {
      description: "Paginated list of quote versions",
      ...jsonContent(listResponseSchema(quoteVersionSchema)),
    },
  },
})

const createQuoteVersionRoute = createRoute({
  method: "post",
  path: "/quotes/{id}/versions",
  request: {
    params: idParamSchema,
    ...requiredJsonBody(insertQuoteVersionSchema.omit({ quoteId: true })),
  },
  responses: {
    201: {
      description: "The created quote version",
      ...jsonContent(z.object({ data: quoteVersionSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Quote not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Quote version conflict", ...jsonContent(errorResponseSchema) },
  },
})

const setQuoteVersionValidityRoute = createRoute({
  method: "patch",
  path: "/quote-versions/{id}/validity",
  request: { params: idParamSchema, ...requiredJsonBody(validityBodySchema) },
  responses: {
    200: {
      description: "The quote version with updated validity",
      ...jsonContent(z.object({ data: quoteVersionSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Quote version not found", ...jsonContent(errorResponseSchema) },
  },
})

const snapshotQuoteVersionRoute = createRoute({
  method: "post",
  path: "/quotes/{id}/versions/snapshot",
  request: { params: idParamSchema },
  responses: {
    201: {
      description: "The created quote version snapshot",
      ...jsonContent(z.object({ data: quoteVersionSchema })),
    },
    404: { description: "Quote not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Quote version conflict", ...jsonContent(errorResponseSchema) },
  },
})

const expireQuoteVersionsRoute = createRoute({
  method: "post",
  path: "/quote-versions/expire",
  description:
    "Expire every sent quote version past its validity date. Accepts an optional " +
    "`now` JSON body; an empty or absent body is accepted. The body is parsed in " +
    "the handler (not as a declared OpenAPI request body) because Hono's JSON " +
    "validator would reject a zero-length `application/json` request before the " +
    "handler runs.",
  responses: {
    200: {
      description: "The expired quote versions",
      ...jsonContent(z.object({ data: z.array(quoteVersionSchema) })),
    },
  },
})

const getQuoteVersionRoute = createRoute({
  method: "get",
  path: "/quote-versions/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "A quote version by id",
      ...jsonContent(z.object({ data: quoteVersionSchema })),
    },
    404: { description: "Quote version not found", ...jsonContent(errorResponseSchema) },
  },
})

const updateQuoteVersionRoute = createRoute({
  method: "patch",
  path: "/quote-versions/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateQuoteVersionSchema) },
  responses: {
    200: {
      description: "The updated quote version",
      ...jsonContent(z.object({ data: quoteVersionSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Quote version not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Quote version conflict", ...jsonContent(errorResponseSchema) },
  },
})

const deleteQuoteVersionRoute = createRoute({
  method: "delete",
  path: "/quote-versions/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Quote version deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Quote version not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Quote version conflict", ...jsonContent(errorResponseSchema) },
  },
})

const versionsCoreChild = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listQuoteVersionsRoute, async (c) =>
    c.json(await quotesService.listQuoteVersions(c.get("db"), c.req.valid("query")), 200),
  )
  .openapi(createQuoteVersionRoute, async (c) => {
    try {
      const body = c.req.valid("json")
      const row = await quotesService.createQuoteVersion(c.get("db"), {
        ...body,
        quoteId: c.req.valid("param").id,
      })
      return c.json({ data: row! }, 201)
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      if (error instanceof QuoteVersionParentNotFoundError) {
        return c.json({ error: "Quote not found" }, 404)
      }
      throw error
    }
  })
  .openapi(setQuoteVersionValidityRoute, async (c) => {
    const row = await quotesService.setQuoteVersionValidUntil(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json").validUntil,
    )
    return row ? c.json({ data: row }, 200) : c.json({ error: "Quote version not found" }, 404)
  })
  .openapi(snapshotQuoteVersionRoute, async (c) => {
    try {
      const version = await quotesService.createVersionSnapshotFromQuote(
        c.get("db"),
        c.req.valid("param").id,
      )
      return version ? c.json({ data: version }, 201) : c.json({ error: "Quote not found" }, 404)
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .openapi(expireQuoteVersionsRoute, async (c) =>
    c.json(
      {
        data: await quotesService.expireQuoteVersions(
          c.get("db"),
          await parseOptionalJsonBody(c, expireQuoteVersionsSchema),
        ),
      },
      200,
    ),
  )
  .openapi(getQuoteVersionRoute, async (c) => {
    const row = await quotesService.getQuoteVersionById(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Quote version not found" }, 404)
  })
  .openapi(updateQuoteVersionRoute, async (c) => {
    try {
      const row = await quotesService.updateQuoteVersion(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      return row ? c.json({ data: row }, 200) : c.json({ error: "Quote version not found" }, 404)
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .openapi(deleteQuoteVersionRoute, async (c) => {
    try {
      const row = await quotesService.deleteQuoteVersion(c.get("db"), c.req.valid("param").id)
      return row
        ? c.json({ success: true } as const, 200)
        : c.json({ error: "Quote version not found" }, 404)
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })

// --- versions: lifecycle transitions ----------------------------------------

const applyTripSnapshotRoute = createRoute({
  method: "post",
  path: "/quote-versions/{id}/trip-snapshot",
  request: { params: idParamSchema, ...requiredJsonBody(applyTripSnapshotToQuoteVersionSchema) },
  responses: {
    200: {
      description: "The quote version with the applied trip snapshot",
      ...jsonContent(z.object({ data: applyTripSnapshotResultSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Quote version not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Quote version conflict", ...jsonContent(errorResponseSchema) },
  },
})

const sendQuoteVersionRoute = createRoute({
  method: "post",
  path: "/quote-versions/{id}/send",
  "x-voyant-api-id": "@voyant-travel/quotes#proposal-extension.api.admin",
  description:
    "Send a quote version for client review. Accepts an optional `validUntil` JSON " +
    "body; an empty or absent body is accepted. The body is parsed in the handler " +
    "(not as a declared OpenAPI request body) because Hono's JSON validator would " +
    "reject a zero-length `application/json` request before the handler runs.",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The sent quote version",
      ...jsonContent(z.object({ data: quoteVersionSchema })),
    },
    404: { description: "Quote version not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Quote version conflict", ...jsonContent(errorResponseSchema) },
  },
})

const viewQuoteVersionRoute = createRoute({
  method: "post",
  path: "/quote-versions/{id}/view",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The quote version marked as viewed",
      ...jsonContent(z.object({ data: quoteVersionSchema })),
    },
    404: { description: "Quote version not found", ...jsonContent(errorResponseSchema) },
  },
})

const acceptQuoteVersionRoute = createRoute({
  method: "post",
  path: "/quote-versions/{id}/accept",
  description:
    "Accept a sent quote version. Accepts an optional JSON body; an empty or absent " +
    "body is accepted. The body is parsed in the handler (not as a declared OpenAPI " +
    "request body) because Hono's JSON validator would reject a zero-length " +
    "`application/json` request before the handler runs.",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The accepted quote version and its quote",
      ...jsonContent(z.object({ data: acceptQuoteVersionResultSchema })),
    },
    404: { description: "Quote version not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Quote version conflict", ...jsonContent(errorResponseSchema) },
  },
})

const declineQuoteVersionRoute = createRoute({
  method: "post",
  path: "/quote-versions/{id}/decline",
  description:
    "Decline a sent quote version. Accepts an optional JSON body; an empty or absent " +
    "body is accepted. The body is parsed in the handler (not as a declared OpenAPI " +
    "request body) because Hono's JSON validator would reject a zero-length " +
    "`application/json` request before the handler runs.",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The declined quote version",
      ...jsonContent(z.object({ data: quoteVersionSchema })),
    },
    404: { description: "Quote version not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Quote version conflict", ...jsonContent(errorResponseSchema) },
  },
})

const versionsLifecycleChild = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(applyTripSnapshotRoute, async (c) => {
    try {
      const row = await quotesService.applyTripSnapshotToQuoteVersion(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      return row ? c.json({ data: row }, 200) : c.json({ error: "Quote version not found" }, 404)
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .openapi(sendQuoteVersionRoute, async (c) => {
    try {
      const row = await quotesService.sendQuoteVersion(
        c.get("db"),
        c.req.valid("param").id,
        await parseOptionalJsonBody(c, sendQuoteVersionSchema),
      )
      return row ? c.json({ data: row }, 200) : c.json({ error: "Quote version not found" }, 404)
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .openapi(viewQuoteVersionRoute, async (c) => {
    const row = await quotesService.markQuoteVersionViewed(c.get("db"), c.req.valid("param").id)
    return row ? c.json({ data: row }, 200) : c.json({ error: "Quote version not found" }, 404)
  })
  .openapi(acceptQuoteVersionRoute, async (c) => {
    try {
      const row = await quotesService.acceptQuoteVersion(
        c.get("db"),
        c.req.valid("param").id,
        await parseOptionalJsonBody(c, acceptQuoteVersionSchema),
      )
      return row ? c.json({ data: row }, 200) : c.json({ error: "Quote version not found" }, 404)
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .openapi(declineQuoteVersionRoute, async (c) => {
    try {
      const row = await quotesService.declineQuoteVersion(
        c.get("db"),
        c.req.valid("param").id,
        await parseOptionalJsonBody(c, declineQuoteVersionSchema),
      )
      return row ? c.json({ data: row }, 200) : c.json({ error: "Quote version not found" }, 404)
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })

// --- version lines ----------------------------------------------------------

const listQuoteVersionLinesRoute = createRoute({
  method: "get",
  path: "/quote-versions/{id}/lines",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Lines for a quote version",
      ...jsonContent(z.object({ data: z.array(quoteVersionLineSchema) })),
    },
  },
})

const createQuoteVersionLineRoute = createRoute({
  method: "post",
  path: "/quote-versions/{id}/lines",
  request: { params: idParamSchema, ...requiredJsonBody(insertQuoteVersionLineSchema) },
  responses: {
    201: {
      description: "The created quote version line",
      ...jsonContent(z.object({ data: quoteVersionLineSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Quote version not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Quote version conflict", ...jsonContent(errorResponseSchema) },
  },
})

const updateQuoteVersionLineRoute = createRoute({
  method: "patch",
  path: "/quote-version-lines/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updateQuoteVersionLineSchema) },
  responses: {
    200: {
      description: "The updated quote version line",
      ...jsonContent(z.object({ data: quoteVersionLineSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Quote version line not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Quote version conflict", ...jsonContent(errorResponseSchema) },
  },
})

const deleteQuoteVersionLineRoute = createRoute({
  method: "delete",
  path: "/quote-version-lines/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Quote version line deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Quote version line not found", ...jsonContent(errorResponseSchema) },
    409: { description: "Quote version conflict", ...jsonContent(errorResponseSchema) },
  },
})

const versionLinesChild = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listQuoteVersionLinesRoute, async (c) =>
    c.json(
      { data: await quotesService.listQuoteVersionLines(c.get("db"), c.req.valid("param").id) },
      200,
    ),
  )
  .openapi(createQuoteVersionLineRoute, async (c) => {
    try {
      const row = await quotesService.createQuoteVersionLine(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      return row ? c.json({ data: row }, 201) : c.json({ error: "Quote version not found" }, 404)
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .openapi(updateQuoteVersionLineRoute, async (c) => {
    try {
      const row = await quotesService.updateQuoteVersionLine(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("json"),
      )
      return row
        ? c.json({ data: row }, 200)
        : c.json({ error: "Quote version line not found" }, 404)
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })
  .openapi(deleteQuoteVersionLineRoute, async (c) => {
    try {
      const row = await quotesService.deleteQuoteVersionLine(c.get("db"), c.req.valid("param").id)
      return row
        ? c.json({ success: true } as const, 200)
        : c.json({ error: "Quote version line not found" }, 404)
    } catch (error) {
      if (error instanceof QuoteVersionConflictError) {
        return c.json({ error: error.message }, 409)
      }
      throw error
    }
  })

export const quoteVersionRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .route("/", versionsCoreChild)
  .route("/", versionsLifecycleChild)
  .route("/", versionLinesChild)

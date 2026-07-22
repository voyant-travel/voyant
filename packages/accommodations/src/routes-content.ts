/**
 * Accommodation content routes — sourced-aware detail endpoint.
 *
 *   GET /:id/content
 *
 * Returns lodging detail content for sourced accommodation inventory:
 * cache hit -> cached row + overlay merge; cache miss with rich adapter ->
 * adapter fetch + write-through; cache miss with thin adapter -> synthesizer
 * fallback.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import {
  CATALOG_EVENTS,
  emitCatalogEvent,
  OVERLAY_DEFAULT_SCOPE,
} from "@voyant-travel/catalog"
import { OverlayVersionConflictError } from "@voyant-travel/catalog/services/overlay"
import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import type { EventBus, Extension } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  openApiValidationHook,
  parseJsonBody,
  parseQuery,
  requireUserId,
} from "@voyant-travel/hono"
import type { ApiExtension } from "@voyant-travel/hono/module"
import type { Context } from "hono"

import { type AccommodationContentScope, getAccommodationContent } from "./service-content.js"
import {
  accommodationPropertyOverlayInvalidationScope,
  ACCOMMODATION_PROPERTY_SUBJECT_MODULE,
  clearAccommodationPropertyOverlay,
  listAccommodationPropertyOverlayHistory,
  readAccommodationPropertyOverlayState,
  readPublicAccommodationPropertyProjection,
  publicAccommodationPropertyProjectionSchema,
  writeAccommodationPropertyOverlay,
} from "./service-presentation-subjects.js"

export interface AccommodationContentRoutesEnv {
  Variables: {
    db: AnyDrizzleDb
    eventBus?: EventBus
    userId?: string
  }
}

export interface CreateAccommodationContentRoutesOptions {
  resolveRegistry: (c: Context) => SourceAdapterRegistry
  onOverlayError?: (event: { field_path: string; reason: string }) => void
  defaultAcceptMachineTranslated?: boolean
  allowEditorialWrites?: boolean
}

export const ACCOMMODATION_CONTENT_OPENAPI_API_IDS = {
  admin: "@voyant-travel/accommodations#content-extension.api.admin",
  public: "@voyant-travel/accommodations#content-extension.api.public",
} as const

type AccommodationContentOpenApiId =
  (typeof ACCOMMODATION_CONTENT_OPENAPI_API_IDS)[keyof typeof ACCOMMODATION_CONTENT_OPENAPI_API_IDS]

export function createAccommodationContentRoutes(
  options: CreateAccommodationContentRoutesOptions,
  apiId?: AccommodationContentOpenApiId,
): OpenAPIHono<AccommodationContentRoutesEnv> {
  const routes = new OpenAPIHono<AccommodationContentRoutesEnv>({
    defaultHook: openApiValidationHook,
  })
  const isAdmin = options.allowEditorialWrites === true
  const effectiveRoute = createRoute({
    method: "get",
    path: "/properties/{id}/effective",
    ...(apiId ? { "x-voyant-api-id": apiId } : {}),
    request: { params: propertyIdParamSchema, query: publicPropertyOverlayScopeSchema },
    responses: {
      200: jsonResponse(
        "Effective accommodation property content",
        z.object({
          data: z.object({
            subject: propertySubjectSchema,
            locale: propertyLocaleMetadataSchema,
            content: publicAccommodationPropertyProjectionSchema,
          }),
        }),
      ),
      404: jsonResponse("Accommodation property was not found", errorResponseSchema),
    },
  })
  routes.openapi(effectiveRoute, async (c) => {
    const query = parseQuery(c, publicPropertyOverlayScopeSchema)
    const result = await readPublicAccommodationPropertyProjection(
      c.var.db,
      c.req.valid("param").id,
      query,
    )
    if (!result) return c.json({ error: "not_found" }, 404)
    return c.json({ data: result }, 200)
  })

  if (isAdmin) {
    const readOverlayRoute = createRoute({
      method: "get",
      path: "/properties/{id}/editorial-overlays",
      ...(apiId ? { "x-voyant-api-id": apiId } : {}),
      request: { params: propertyIdParamSchema, query: propertyOverlayScopeSchema },
      responses: {
        200: jsonResponse(
          "Property source, overlays, and effective content",
          propertyOverlayStateResponseSchema,
        ),
        404: jsonResponse("Accommodation property was not found", errorResponseSchema),
      },
    })
    routes.openapi(readOverlayRoute, async (c) => {
      const query = parseQuery(c, propertyOverlayScopeSchema)
      const result = await readAccommodationPropertyOverlayState(
        c.var.db,
        c.req.valid("param").id,
        query,
      )
      if (!result) return c.json({ error: "not_found" }, 404)
      return c.json({ data: result }, 200)
    })

    const writeOverlayRoute = createRoute({
      method: "put",
      path: "/properties/{id}/editorial-overlays",
      ...(apiId ? { "x-voyant-api-id": apiId } : {}),
      request: {
        params: propertyIdParamSchema,
        body: {
          required: true,
          content: { "application/json": { schema: propertyOverlayWriteBodySchema } },
        },
      },
      responses: {
        200: jsonResponse("Property editorial overlay written", propertyOverlayRowResponseSchema),
        400: jsonResponse("Invalid overlay field, scope, or value", errorResponseSchema),
        409: jsonResponse("Overlay version conflict", errorResponseSchema),
      },
    })
    routes.openapi(writeOverlayRoute, async (c) => {
      const userId = requireUserId(c)
      const body = await parseJsonBody(c, propertyOverlayWriteBodySchema)
      const propertyId = c.req.valid("param").id
      const scope = {
        locale: body.locale,
        audience: body.audience,
        market: body.market,
      }
      let row: Awaited<ReturnType<typeof writeAccommodationPropertyOverlay>>
      try {
        row = await writeAccommodationPropertyOverlay(c.var.db, propertyId, {
          field_path: body.fieldPath,
          scope,
          value: body.value,
          expected_version: body.expectedVersion,
          editorial_note: body.editorialNote,
          origin: { kind: "admin-ui", user_id: userId },
        })
      } catch (err) {
        if (err instanceof OverlayVersionConflictError) {
          return c.json({ error: "version_conflict", currentVersion: err.currentVersion }, 409)
        }
        return c.json(
          { error: "invalid_editorial_overlay", detail: errorMessage(err) },
          400,
        )
      }
      await emitAccommodationPropertyOverlayChanged(
        c.var.eventBus,
        propertyId,
        body.fieldPath,
        scope,
      )
      return c.json({ data: row }, 200)
    })

    const clearOverlayRoute = createRoute({
      method: "delete",
      path: "/properties/{id}/editorial-overlays",
      ...(apiId ? { "x-voyant-api-id": apiId } : {}),
      request: { params: propertyIdParamSchema, query: propertyOverlayTargetQuerySchema },
      responses: {
        200: jsonResponse("Property editorial overlay cleared", propertyOverlayClearResponseSchema),
        400: jsonResponse("Invalid overlay field or scope", errorResponseSchema),
        409: jsonResponse("Overlay version conflict", errorResponseSchema),
      },
    })
    routes.openapi(clearOverlayRoute, async (c) => {
      requireUserId(c)
      const query = parseQuery(c, propertyOverlayTargetQuerySchema)
      const propertyId = c.req.valid("param").id
      const scope = {
        locale: query.locale,
        audience: query.audience,
        market: query.market,
      }
      let row: Awaited<ReturnType<typeof clearAccommodationPropertyOverlay>>
      try {
        row = await clearAccommodationPropertyOverlay(c.var.db, propertyId, {
          field_path: query.fieldPath,
          scope,
          expected_version: query.expectedVersion,
        })
      } catch (err) {
        if (err instanceof OverlayVersionConflictError) {
          return c.json({ error: "version_conflict", currentVersion: err.currentVersion }, 409)
        }
        return c.json(
          { error: "invalid_editorial_overlay", detail: errorMessage(err) },
          400,
        )
      }
      if (row) {
        await emitAccommodationPropertyOverlayChanged(
          c.var.eventBus,
          propertyId,
          query.fieldPath,
          scope,
        )
      }
      return c.json({ data: { cleared: row != null, overlay: row } }, 200)
    })

    const overlayHistoryRoute = createRoute({
      method: "get",
      path: "/properties/{id}/editorial-overlays/history",
      ...(apiId ? { "x-voyant-api-id": apiId } : {}),
      request: { params: propertyIdParamSchema, query: propertyOverlayHistoryQuerySchema },
      responses: {
        200: jsonResponse(
          "Property editorial overlay audit history",
          propertyOverlayHistoryResponseSchema,
        ),
      },
    })
    routes.openapi(overlayHistoryRoute, async (c) => {
      requireUserId(c)
      const query = parseQuery(c, propertyOverlayHistoryQuerySchema)
      const rows = await listAccommodationPropertyOverlayHistory(
        c.var.db,
        c.req.valid("param").id,
        {
          field_path: query.fieldPath,
          locale: query.locale,
          audience: query.audience,
          market: query.market,
        },
      )
      return c.json({ data: rows }, 200)
    })
  }

  routes.get("/:id/content", async (c) => {
    const entityId = c.req.param("id")
    const scope = parseScope(c)
    const registry = options.resolveRegistry(c)

    const result = await getAccommodationContent(c.var.db, entityId, scope, {
      registry,
      onOverlayError: options.onOverlayError,
    })

    if (!result) {
      return c.json(
        {
          error: "not_found",
          detail: `Accommodation ${entityId} has no sourced-content row.`,
        },
        404,
      )
    }

    return c.json({
      data: {
        content: result.content,
        provenance: result.provenance,
        served_locale: result.resolution.served_locale,
        match_kind: result.resolution.match_kind,
        source: result.source,
        served_stale: result.served_stale,
        synthesized: result.synthesized,
        machine_translated: result.machine_translated,
      },
    })
  })
  routes.openAPIRegistry.registerPath({
    method: "get",
    path: "/{id}/content",
    summary: "Get accommodation content",
    responses: {
      200: { description: "Localized accommodation content and provenance." },
      404: { description: "Accommodation content was not found." },
    },
    ...(apiId ? { "x-voyant-api-id": apiId } : {}),
  })

  return routes

  function parseScope(c: Context): AccommodationContentScope {
    const localeParams = c.req.queries("locale") ?? c.req.queries("locales") ?? []
    const headerLocale = c.req.header("accept-language")
    const acceptLanguageList = headerLocale ? parseAcceptLanguage(headerLocale) : []
    const preferredLocales =
      localeParams.length > 0
        ? localeParams
        : acceptLanguageList.length > 0
          ? acceptLanguageList
          : ["en-GB"]

    const market = c.req.query("market") ?? undefined
    const currency = c.req.query("currency") ?? undefined
    const acceptMTQuery = c.req.query("accept_mt")
    const acceptMachineTranslated =
      acceptMTQuery != null
        ? acceptMTQuery !== "false" && acceptMTQuery !== "0"
        : (options.defaultAcceptMachineTranslated ?? true)

    return {
      preferredLocales,
      market,
      currency,
      acceptMachineTranslated,
    }
  }
}

const propertyOverlayAudienceSchema = z.enum([
  "staff",
  "customer",
  "partner",
  "supplier",
  "default",
])
const publicPropertyOverlayAudienceSchema = z.enum(["customer", "partner"])
const nonemptyString = z.string().trim().min(1)
const propertyIdParamSchema = z.object({ id: nonemptyString })
const propertyOverlayScopeSchema = z.object({
  locale: nonemptyString.default("en-GB"),
  audience: propertyOverlayAudienceSchema.default("customer"),
  market: nonemptyString.default(OVERLAY_DEFAULT_SCOPE),
})
const publicPropertyOverlayScopeSchema = z.object({
  locale: nonemptyString.default("en-GB"),
  audience: publicPropertyOverlayAudienceSchema.default("customer"),
  market: nonemptyString.default(OVERLAY_DEFAULT_SCOPE),
})
const propertyOverlayWriteCommonSchema = z.object({
  locale: nonemptyString.default("en-GB"),
  audience: propertyOverlayAudienceSchema.default("customer"),
  market: nonemptyString.default(OVERLAY_DEFAULT_SCOPE),
  expectedVersion: z.number().int().nullable().optional(),
  editorialNote: z.string().optional(),
})
const propertyOverlayWriteBodySchema = z.intersection(
  propertyOverlayWriteCommonSchema,
  z.discriminatedUnion("fieldPath", [
    z.object({ fieldPath: z.literal("name"), value: nonemptyString }),
    z.object({ fieldPath: z.literal("description"), value: z.string() }),
    z.object({ fieldPath: z.literal("hero_image_url"), value: z.string().url() }),
    z.object({ fieldPath: z.literal("gallery"), value: z.array(z.string().url()) }),
    z.object({ fieldPath: z.literal("highlights"), value: z.array(nonemptyString) }),
    z.object({ fieldPath: z.literal("amenities"), value: z.array(nonemptyString) }),
  ]),
)
const propertyOverlayTargetQuerySchema = z.object({
  fieldPath: z.enum([
    "name",
    "description",
    "hero_image_url",
    "gallery",
    "highlights",
    "amenities",
  ]),
  locale: nonemptyString.default("en-GB"),
  audience: propertyOverlayAudienceSchema.default("customer"),
  market: nonemptyString.default(OVERLAY_DEFAULT_SCOPE),
  expectedVersion: z.coerce.number().int().optional(),
})
const propertyOverlayHistoryQuerySchema = propertyOverlayTargetQuerySchema.partial()

const propertySubjectSchema = z.object({
  module: z.literal("accommodation-properties"),
  id: nonemptyString,
})
const propertyLocaleMetadataSchema = z.object({
  requestedLocale: nonemptyString,
  sourceLocale: nonemptyString.nullable(),
  servedLocale: nonemptyString,
  matchKind: z.enum(["exact", "mixed", "overlay-only"]),
})
const errorResponseSchema = z.object({
  error: z.string(),
  detail: z.string().optional(),
  currentVersion: z.number().int().nullable().optional(),
})
const propertyOverlayRowSchema = z.object({ id: nonemptyString }).passthrough()
const propertyOverlayStateResponseSchema = z.object({
  data: z.object({ subject: propertySubjectSchema }).passthrough(),
})
const propertyOverlayRowResponseSchema = z.object({ data: propertyOverlayRowSchema })
const propertyOverlayClearResponseSchema = z.object({
  data: z.object({
    cleared: z.boolean(),
    overlay: propertyOverlayRowSchema.nullable(),
  }),
})
const propertyOverlayHistoryResponseSchema = z.object({
  data: z.array(propertyOverlayRowSchema),
})

function jsonResponse<T extends z.ZodTypeAny>(description: string, schema: T) {
  return { description, content: { "application/json": { schema } } }
}

async function emitAccommodationPropertyOverlayChanged(
  eventBus: EventBus | undefined,
  propertyId: string,
  fieldPath: string,
  scope: z.infer<typeof propertyOverlayScopeSchema>,
): Promise<void> {
  if (!eventBus) return
  const invalidation = accommodationPropertyOverlayInvalidationScope(fieldPath, scope)
  await emitCatalogEvent(eventBus, CATALOG_EVENTS.ENTITY_OVERLAY_CHANGED, {
    entity_module: ACCOMMODATION_PROPERTY_SUBJECT_MODULE,
    entity_id: propertyId,
    field_path: fieldPath,
    locale: invalidation.locale,
    audience: invalidation.audience,
    market: invalidation.market,
    occurred_at: new Date().toISOString(),
  })
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export interface AccommodationContentApiExtensionOptions {
  admin: CreateAccommodationContentRoutesOptions
  public: CreateAccommodationContentRoutesOptions
}

export const accommodationContentExtension: Extension = {
  name: "content",
  module: "accommodations",
}

/** Build accommodation content routes for operator and storefront callers. */
export function createAccommodationContentApiExtension(
  options: AccommodationContentApiExtensionOptions,
): ApiExtension {
  return {
    extension: accommodationContentExtension,
    adminRoutes: createAccommodationContentRoutes(
      options.admin,
      ACCOMMODATION_CONTENT_OPENAPI_API_IDS.admin,
    ),
    publicRoutes: createAccommodationContentRoutes(
      options.public,
      ACCOMMODATION_CONTENT_OPENAPI_API_IDS.public,
    ),
  }
}

export function parseAcceptLanguage(header: string): string[] {
  const parts = header.split(",")
  const ranked: Array<{ tag: string; q: number; idx: number }> = []
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!.trim()
    if (!part) continue
    const [tagRaw, ...params] = part.split(";")
    const tag = tagRaw!.trim()
    if (!tag || tag === "*") continue
    let q = 1
    for (const p of params) {
      const [k, v] = p.split("=").map((s) => s.trim())
      if (k === "q" && v) {
        const parsed = Number.parseFloat(v)
        if (Number.isFinite(parsed)) q = parsed
      }
    }
    ranked.push({ tag, q, idx: i })
  }
  ranked.sort((a, b) => b.q - a.q || a.idx - b.idx)
  return ranked.map((r) => r.tag)
}

export type AccommodationContentRoutes = ReturnType<typeof createAccommodationContentRoutes>

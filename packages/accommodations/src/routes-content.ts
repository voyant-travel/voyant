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

import { OpenAPIHono, z } from "@hono/zod-openapi"
import { OVERLAY_DEFAULT_SCOPE } from "@voyant-travel/catalog"
import { OverlayVersionConflictError } from "@voyant-travel/catalog/services/overlay"
import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import type { Extension } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { parseJsonBody, parseQuery, requireUserId } from "@voyant-travel/hono"
import type { ApiExtension } from "@voyant-travel/hono/module"
import type { Context } from "hono"

import { type AccommodationContentScope, getAccommodationContent } from "./service-content.js"
import {
  clearAccommodationPropertyOverlay,
  listAccommodationPropertyOverlayHistory,
  readAccommodationPropertyOverlayState,
  readPublicAccommodationPropertyProjection,
  writeAccommodationPropertyOverlay,
} from "./service-presentation-subjects.js"

export interface AccommodationContentRoutesEnv {
  Variables: {
    db: AnyDrizzleDb
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
  const routes = new OpenAPIHono<AccommodationContentRoutesEnv>()
  routes.get("/properties/:id/effective", async (c) => {
    const result = await readPublicAccommodationPropertyProjection(
      c.var.db,
      c.req.param("id"),
      parsePropertyOverlayScope(c, "customer"),
    )
    if (!result) return c.json({ error: "not_found" }, 404)
    return c.json({ data: result })
  })
  routes.openAPIRegistry.registerPath({
    method: "get",
    path: "/properties/{id}/effective",
    summary: "Get effective accommodation property content",
    responses: {
      200: { description: "Effective property content without source or origin data." },
      404: { description: "Accommodation property was not found." },
    },
    ...(apiId ? { "x-voyant-api-id": apiId } : {}),
  })

  if (options.allowEditorialWrites) {
    routes.get("/properties/:id/editorial-overlays", async (c) => {
      const result = await readAccommodationPropertyOverlayState(
        c.var.db,
        c.req.param("id"),
        parsePropertyOverlayScope(c, "customer"),
      )
      if (!result) return c.json({ error: "not_found" }, 404)
      return c.json({ data: result })
    })
    routes.put("/properties/:id/editorial-overlays", async (c) => {
      const userId = requireUserId(c)
      try {
        const body = await parseJsonBody(c, propertyOverlayWriteBodySchema)
        const row = await writeAccommodationPropertyOverlay(c.var.db, c.req.param("id"), {
          field_path: body.fieldPath,
          scope: {
            locale: body.locale,
            audience: body.audience,
            market: body.market,
          },
          value: body.value,
          expected_version: body.expectedVersion,
          editorial_note: body.editorialNote,
          origin: { kind: "admin-ui", user_id: userId },
        })
        return c.json({ data: row })
      } catch (err) {
        if (err instanceof OverlayVersionConflictError) {
          return c.json({ error: "version_conflict", currentVersion: err.currentVersion }, 409)
        }
        return c.json({ error: "invalid_editorial_overlay", detail: errorMessage(err) }, 400)
      }
    })
    routes.delete("/properties/:id/editorial-overlays", async (c) => {
      try {
        requireUserId(c)
        const query = parseQuery(c, propertyOverlayTargetQuerySchema)
        const row = await clearAccommodationPropertyOverlay(c.var.db, c.req.param("id"), {
          field_path: query.fieldPath,
          scope: {
            locale: query.locale,
            audience: query.audience,
            market: query.market,
          },
          expected_version: query.expectedVersion,
        })
        return c.json({ data: { cleared: row != null, overlay: row } })
      } catch (err) {
        if (err instanceof OverlayVersionConflictError) {
          return c.json({ error: "version_conflict", currentVersion: err.currentVersion }, 409)
        }
        throw err
      }
    })
    routes.get("/properties/:id/editorial-overlays/history", async (c) => {
      requireUserId(c)
      const query = parseQuery(c, propertyOverlayTargetQuerySchema.partial())
      const rows = await listAccommodationPropertyOverlayHistory(c.var.db, c.req.param("id"), {
        field_path: query.fieldPath,
        locale: query.locale,
        audience: query.audience,
        market: query.market,
      })
      return c.json({ data: rows })
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
const propertyOverlayLocaleSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => value !== OVERLAY_DEFAULT_SCOPE, {
    message: "locale must be a real locale, not the default scope sentinel",
  })
const propertyOverlayWriteBodySchema = z.object({
  fieldPath: z.string().trim().min(1),
  locale: propertyOverlayLocaleSchema.default("en-GB"),
  audience: propertyOverlayAudienceSchema.default("customer"),
  market: z.string().trim().min(1).default(OVERLAY_DEFAULT_SCOPE),
  value: z.unknown(),
  expectedVersion: z.number().int().nullable().optional(),
  editorialNote: z.string().optional(),
})
const propertyOverlayTargetQuerySchema = z.object({
  fieldPath: z.string().trim().min(1),
  locale: z.string().trim().min(1).default("en-GB"),
  audience: propertyOverlayAudienceSchema.default("customer"),
  market: z.string().trim().min(1).default(OVERLAY_DEFAULT_SCOPE),
  expectedVersion: z.coerce.number().int().optional(),
})

function parsePropertyOverlayScope(c: Context, defaultAudience: "staff" | "customer") {
  const audience = c.req.query("audience") ?? defaultAudience
  return {
    locale: c.req.query("locale") ?? "en-GB",
    audience: propertyOverlayAudienceSchema.parse(audience),
    market: c.req.query("market") ?? OVERLAY_DEFAULT_SCOPE,
  }
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

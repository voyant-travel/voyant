import { type OpenAPIHono, z } from "@hono/zod-openapi"

import { parseUnifiedKey } from "./lib/key.js"
import type { CruiseRoutesEnv as Env } from "./routes-env.js"
import {
  adapterNotRegistered,
  entityIdFromExternal,
  invalidKey,
  makeExternalKey,
  readContentScope,
  registryNotConfigured,
  resolveExternal,
} from "./routes-keying.js"
import { createCruisesAdminRoute as createRoute } from "./routes-openapi.js"
import {
  cruiseDayRowSchema,
  cruiseRowSchema,
  dataEnvelope,
  enrichmentProgramRowSchema,
  errorResponseSchema,
} from "./routes-openapi-schemas.js"
import { cruisesService } from "./service.js"
import { getCruiseContent } from "./service-content.js"
import { detachExternalCruise } from "./service-detach.js"
import {
  insertEnrichmentProgramSchema,
  replaceEnrichmentProgramsSchema,
} from "./validation-content.js"
import { updateCruiseSchema } from "./validation-core.js"
import { replaceCruiseDaysSchema } from "./validation-itinerary.js"

const keyParamSchema = z.object({ key: z.string() })
const arrayEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: z.array(item) })
const jsonContent = <T extends z.ZodTypeAny>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema } },
})

/**
 * Cruise-detail read dispatches to a local DB aggregate or the catalog content
 * service depending on the unified key; the two payload shapes differ, so the
 * envelope `data` is documented as an opaque pass-through (bounded effort per
 * voyant#2114).
 */
const cruiseDetailDataSchema = z.object({ data: z.unknown() })

/**
 * Sailings-for-cruise envelope. Local reads return the canonical
 * `{ data, total, limit, offset }`; external reads return `{ data, total }`
 * (no pagination window), and the items are heterogeneous (local rows vs
 * external `{ source, key, sailing }`), so `data` is an opaque array.
 */
const sailingsForCruiseSchema = z.object({
  data: z.array(z.unknown()),
  total: z.number().int(),
  limit: z.number().int().optional(),
  offset: z.number().int().optional(),
})

const getCruiseRoute = createRoute({
  method: "get",
  path: "/{key}",
  request: { params: keyParamSchema },
  responses: {
    200: jsonContent(
      "A cruise by unified key (local aggregate or external content)",
      cruiseDetailDataSchema,
    ),
    400: jsonContent("Key is not a valid local id or external key", errorResponseSchema),
    404: jsonContent("Cruise not found", errorResponseSchema),
    503: jsonContent("Source-adapter registry is not configured", errorResponseSchema),
  },
})

const updateCruiseRoute = createRoute({
  method: "put",
  path: "/{key}",
  request: {
    params: keyParamSchema,
    body: { required: true, content: { "application/json": { schema: updateCruiseSchema } } },
  },
  responses: {
    200: jsonContent("The updated cruise", dataEnvelope(cruiseRowSchema)),
    400: jsonContent("Key is not a valid local id", errorResponseSchema),
    404: jsonContent("Cruise not found", errorResponseSchema),
    409: jsonContent("External cruise is read-only", errorResponseSchema),
  },
})

const deleteCruiseRoute = createRoute({
  method: "delete",
  path: "/{key}",
  request: { params: keyParamSchema },
  responses: {
    200: jsonContent("The archived cruise", dataEnvelope(cruiseRowSchema)),
    400: jsonContent("Key is not a valid local id", errorResponseSchema),
    404: jsonContent("Cruise not found", errorResponseSchema),
    409: jsonContent("External cruise is read-only", errorResponseSchema),
  },
})

const recomputeAggregatesRoute = createRoute({
  method: "post",
  path: "/{key}/aggregates/recompute",
  request: { params: keyParamSchema },
  responses: {
    200: jsonContent("The cruise with recomputed aggregates", dataEnvelope(cruiseRowSchema)),
    400: jsonContent("Key is not a valid local id", errorResponseSchema),
    404: jsonContent("Cruise not found", errorResponseSchema),
    409: jsonContent("External cruise is read-only", errorResponseSchema),
  },
})

const listCruiseSailingsRoute = createRoute({
  method: "get",
  path: "/{key}/sailings",
  request: { params: keyParamSchema },
  responses: {
    200: jsonContent(
      "Sailings for the cruise (local rows or external adapter shapes)",
      sailingsForCruiseSchema,
    ),
    400: jsonContent("Key is not a valid local id or external key", errorResponseSchema),
    501: jsonContent("Referenced adapter is not registered", errorResponseSchema),
  },
})

const replaceCruiseDaysRoute = createRoute({
  method: "put",
  path: "/{key}/days/bulk",
  request: {
    params: keyParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: replaceCruiseDaysSchema.omit({ cruiseId: true }) } },
    },
  },
  responses: {
    200: jsonContent("The replaced itinerary days", arrayEnvelope(cruiseDayRowSchema)),
    400: jsonContent("Key is not a valid local id", errorResponseSchema),
    409: jsonContent("External cruise is read-only", errorResponseSchema),
  },
})

const refreshCruiseRoute = createRoute({
  method: "post",
  path: "/{key}/refresh",
  request: { params: keyParamSchema },
  responses: {
    200: jsonContent("The refreshed external cruise content", cruiseDetailDataSchema),
    400: jsonContent("Key is not an external cruise key", errorResponseSchema),
    404: jsonContent("No sourced-entry row for the cruise", errorResponseSchema),
    503: jsonContent("Source-adapter registry is not configured", errorResponseSchema),
  },
})

const detachCruiseRoute = createRoute({
  method: "post",
  path: "/{key}/detach",
  request: { params: keyParamSchema },
  responses: {
    201: jsonContent("The detached (now-local) cruise", dataEnvelope(cruiseRowSchema)),
    400: jsonContent("Key is not an external cruise key", errorResponseSchema),
    501: jsonContent("Referenced adapter is not registered", errorResponseSchema),
  },
})

const listEnrichmentRoute = createRoute({
  method: "get",
  path: "/{key}/enrichment",
  request: { params: keyParamSchema },
  responses: {
    200: jsonContent(
      "Enrichment programs for the cruise (empty for external cruises)",
      arrayEnvelope(enrichmentProgramRowSchema),
    ),
    400: jsonContent("Key is not a valid local id or external key", errorResponseSchema),
    501: jsonContent("Referenced adapter is not registered", errorResponseSchema),
  },
})

const createEnrichmentRoute = createRoute({
  method: "post",
  path: "/{key}/enrichment",
  request: {
    params: keyParamSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: insertEnrichmentProgramSchema.omit({ cruiseId: true }) },
      },
    },
  },
  responses: {
    201: jsonContent("The created enrichment program", dataEnvelope(enrichmentProgramRowSchema)),
    400: jsonContent("Key is not a valid local id", errorResponseSchema),
    409: jsonContent("External cruise is read-only", errorResponseSchema),
  },
})

const replaceEnrichmentRoute = createRoute({
  method: "put",
  path: "/{key}/enrichment/bulk",
  request: {
    params: keyParamSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: replaceEnrichmentProgramsSchema.omit({ cruiseId: true }) },
      },
    },
  },
  responses: {
    200: jsonContent("The replaced enrichment programs", arrayEnvelope(enrichmentProgramRowSchema)),
    400: jsonContent("Key is not a valid local id", errorResponseSchema),
    409: jsonContent("External cruise is read-only", errorResponseSchema),
  },
})

export function registerCruiseDetailRoutes(app: OpenAPIHono<Env>) {
  // --- per-cruise (parses unified key, dispatches local or external) ---
  // Keep wildcard key routes after static admin subresources so reserved
  // segments such as /sailings, /ships, and /prices reach their handlers.
  app.openapi(getCruiseRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") {
      const registry = c.get("sourceAdapterRegistry")
      if (!registry) return c.json(registryNotConfigured(), 503)

      const entityId = entityIdFromExternal(parsed)
      const result = await getCruiseContent(c.get("db"), entityId, readContentScope(c), {
        registry,
      })
      if (!result) {
        return c.json(
          {
            error: "not_found",
            detail: `No sourced-entry row for cruise ${parsed.provider}:${parsed.ref} (entity ${entityId}). Run discovery first or check that an adapter is registered for "${parsed.provider}".`,
          },
          404,
        )
      }
      return c.json(
        {
          data: {
            source: "external",
            sourceProvider: parsed.provider,
            sourceRef: parsed.ref,
            entityId,
            content: result.content,
            servedLocale: result.resolution.served_locale,
            matchKind: result.resolution.match_kind,
            contentSource: result.source,
            servedStale: result.served_stale,
            synthesized: result.synthesized,
            machineTranslated: result.machine_translated,
          },
        },
        200,
      )
    }
    const includeRaw = c.req.query("include") ?? ""
    const includes = new Set(
      includeRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    const row = await cruisesService.getCruiseById(c.get("db"), parsed.id, {
      withSailings: includes.has("sailings"),
      withDays: includes.has("days"),
    })
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json(
      {
        data: {
          source: "local",
          sourceProvider: null,
          sourceRef: null,
          cruise: row,
        },
      },
      200,
    )
  })
  app.openapi(updateCruiseRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "external") {
      return c.json(
        {
          error: "external_cruise_read_only",
          detail: `External cruise from '${parsed.provider}' cannot be edited locally. Edit at the upstream system, or POST /:key/detach to convert to a local cruise first.`,
        },
        409,
      )
    }
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    const row = await cruisesService.updateCruise(c.get("db"), parsed.id, c.req.valid("json"), {
      eventBus: c.get("eventBus"),
    })
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row }, 200)
  })
  app.openapi(deleteCruiseRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "external") {
      return c.json(
        {
          error: "external_cruise_read_only",
          detail: "External cruises can't be deleted locally.",
        },
        409,
      )
    }
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    const row = await cruisesService.archiveCruise(c.get("db"), parsed.id, {
      eventBus: c.get("eventBus"),
    })
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row }, 200)
  })
  app.openapi(recomputeAggregatesRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "external") {
      return c.json(
        { error: "external_cruise_read_only", detail: "Aggregates only apply to local cruises." },
        409,
      )
    }
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    const row = await cruisesService.recomputeCruiseAggregates(c.get("db"), parsed.id)
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row }, 200)
  })
  app.openapi(listCruiseSailingsRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") {
      const ext = resolveExternal(parsed)
      if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
      const sailings = await ext.adapter.listSailingsForCruise(ext.sourceRef)
      return c.json(
        {
          data: sailings.map((s) => ({
            source: "external",
            sourceProvider: ext.adapter.name,
            key: makeExternalKey(ext.adapter, s.sourceRef),
            sailing: s,
          })),
          total: sailings.length,
        },
        200,
      )
    }
    const result = await cruisesService.listSailings(c.get("db"), {
      cruiseId: parsed.id,
      limit: 100,
      offset: 0,
    })
    return c.json(result, 200)
  })
  app.openapi(replaceCruiseDaysRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "external") {
      return c.json({ error: "external_cruise_read_only" }, 409)
    }
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    const payload = c.req.valid("json")
    const days = await cruisesService.replaceCruiseDays(c.get("db"), {
      cruiseId: parsed.id,
      days: payload.days,
    })
    return c.json({ data: days }, 200)
  })
  // --- external-only operations ---
  app.openapi(refreshCruiseRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind !== "external") return c.json({ error: "local_cruise_no_refresh" }, 400)
    const registry = c.get("sourceAdapterRegistry")
    if (!registry) return c.json(registryNotConfigured(), 503)

    const entityId = entityIdFromExternal(parsed)
    const { invalidateCruiseContentOnDrift } = await import("./service-content.js")
    await invalidateCruiseContentOnDrift(c.get("db"), {
      id: `cnde_refresh_${Date.now()}`,
      entity_module: "cruises",
      entity_id: entityId,
      kind: "content_invalidated",
      detected_at: new Date(),
    })
    const result = await getCruiseContent(c.get("db"), entityId, readContentScope(c), {
      registry,
    })
    if (!result) {
      return c.json(
        {
          error: "not_found",
          detail: `No sourced-entry row for cruise ${parsed.provider}:${parsed.ref} (entity ${entityId}).`,
        },
        404,
      )
    }
    return c.json(
      {
        data: {
          source: "external",
          sourceProvider: parsed.provider,
          sourceRef: parsed.ref,
          entityId,
          content: result.content,
          contentSource: result.source,
          servedStale: result.served_stale,
          refreshedAt: new Date().toISOString(),
        },
      },
      200,
    )
  })
  app.openapi(detachCruiseRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind !== "external") return c.json({ error: "local_cruise_no_detach" }, 400)
    const ext = resolveExternal(parsed)
    if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
    const cruise = await detachExternalCruise(c.get("db"), ext.adapter, ext.sourceRef)
    return c.json({ data: cruise }, 201)
  })
  // --- enrichment programs (expedition-focused; local cruises only) ---
  app.openapi(listEnrichmentRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "external") {
      const ext = resolveExternal(parsed)
      if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
      // Adapters surface enrichment via the rich cruise detail; we return an
      // empty list here for shape compatibility. Templates that need richer
      // external enrichment should read from adapter.fetchCruise() directly.
      return c.json({ data: [] }, 200)
    }
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    const programs = await cruisesService.listEnrichmentPrograms(c.get("db"), parsed.id)
    return c.json({ data: programs }, 200)
  })
  app.openapi(createEnrichmentRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "external") return c.json({ error: "external_cruise_read_only" }, 409)
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    const data = c.req.valid("json")
    const row = await cruisesService.createEnrichmentProgram(c.get("db"), {
      ...data,
      cruiseId: parsed.id,
    })
    return c.json({ data: row }, 201)
  })
  app.openapi(replaceEnrichmentRoute, async (c) => {
    const parsed = parseUnifiedKey(c.req.valid("param").key)
    if (parsed.kind === "external") return c.json({ error: "external_cruise_read_only" }, 409)
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    const payload = c.req.valid("json")
    const rows = await cruisesService.replaceEnrichmentPrograms(c.get("db"), {
      cruiseId: parsed.id,
      programs: payload.programs,
    })
    return c.json({ data: rows }, 200)
  })
}

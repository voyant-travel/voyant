import { parseJsonBody } from "@voyantjs/hono"
import type { Hono } from "hono"

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
import { cruisesService } from "./service.js"
import { getCruiseContent } from "./service-content.js"
import { detachExternalCruise } from "./service-detach.js"
import {
  insertEnrichmentProgramSchema,
  replaceEnrichmentProgramsSchema,
} from "./validation-content.js"
import { updateCruiseSchema } from "./validation-core.js"
import { replaceCruiseDaysSchema } from "./validation-itinerary.js"

export function registerCruiseDetailRoutes(app: Hono<Env>) {
  app
    // --- per-cruise (parses unified key, dispatches local or external) ---
    // Keep wildcard key routes after static admin subresources so reserved
    // segments such as /sailings, /ships, and /prices reach their handlers.
    // External branch dispatches through the catalog content service
    // (cache-first, SWR refresh, synthesizer fallback) — flipped from
    // ad-hoc adapter.fetchCruise() per the catalog-sourced-content
    // migration. Returns the rich CruiseContent shape; templates that
    // need backwards-compatible ExternalCruise can post-process the
    // response.
    .get("/:key", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
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
        return c.json({
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
        })
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
      return c.json({
        data: {
          source: "local",
          sourceProvider: null,
          sourceRef: null,
          cruise: row,
        },
      })
    })
    .put("/:key", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
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
      const data = await parseJsonBody(c, updateCruiseSchema)
      const row = await cruisesService.updateCruise(c.get("db"), parsed.id, data, {
        eventBus: c.get("eventBus"),
      })
      if (!row) return c.json({ error: "not_found" }, 404)
      return c.json({ data: row })
    })
    .delete("/:key", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
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
      return c.json({ data: row })
    })
    .post("/:key/aggregates/recompute", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "external") {
        return c.json(
          { error: "external_cruise_read_only", detail: "Aggregates only apply to local cruises." },
          409,
        )
      }
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      const row = await cruisesService.recomputeCruiseAggregates(c.get("db"), parsed.id)
      if (!row) return c.json({ error: "not_found" }, 404)
      return c.json({ data: row })
    })
    .get("/:key/sailings", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      if (parsed.kind === "external") {
        const ext = resolveExternal(parsed)
        if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
        const sailings = await ext.adapter.listSailingsForCruise(ext.sourceRef)
        return c.json({
          data: sailings.map((s) => ({
            source: "external",
            sourceProvider: ext.adapter.name,
            key: makeExternalKey(ext.adapter, s.sourceRef),
            sailing: s,
          })),
          total: sailings.length,
        })
      }
      const result = await cruisesService.listSailings(c.get("db"), {
        cruiseId: parsed.id,
        limit: 100,
        offset: 0,
      })
      return c.json(result)
    })
    .put("/:key/days/bulk", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "external") {
        return c.json({ error: "external_cruise_read_only" }, 409)
      }
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      const payload = await parseJsonBody(c, replaceCruiseDaysSchema.omit({ cruiseId: true }))
      const days = await cruisesService.replaceCruiseDays(c.get("db"), {
        cruiseId: parsed.id,
        days: payload.days,
      })
      return c.json({ data: days })
    })
    // --- external-only operations ---
    // Refresh dispatches through the catalog content service. The
    // invalidator marks the cache row stale; the subsequent
    // getCruiseContent call sees the staleness and triggers a SWR
    // refresh. Templates that need synchronous "force fresh from
    // upstream" semantics should call adapter.getContent() directly
    // — this route's contract is "best effort refresh, eventually
    // consistent."
    .post("/:key/refresh", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
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
      return c.json({
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
      })
    })
    .post("/:key/detach", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind !== "external") return c.json({ error: "local_cruise_no_detach" }, 400)
      const ext = resolveExternal(parsed)
      if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
      const cruise = await detachExternalCruise(c.get("db"), ext.adapter, ext.sourceRef)
      return c.json({ data: cruise }, 201)
    })
    // --- enrichment programs (expedition-focused; local cruises only) ---
    .get("/:key/enrichment", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "external") {
        const ext = resolveExternal(parsed)
        if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
        // Adapters surface enrichment via the rich cruise detail; we return an
        // empty list here for shape compatibility. Templates that need richer
        // external enrichment should read from adapter.fetchCruise() directly.
        return c.json({ data: [] })
      }
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      const programs = await cruisesService.listEnrichmentPrograms(c.get("db"), parsed.id)
      return c.json({ data: programs })
    })
    .post("/:key/enrichment", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "external") return c.json({ error: "external_cruise_read_only" }, 409)
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      const data = await parseJsonBody(c, insertEnrichmentProgramSchema.omit({ cruiseId: true }))
      const row = await cruisesService.createEnrichmentProgram(c.get("db"), {
        ...data,
        cruiseId: parsed.id,
      })
      return c.json({ data: row }, 201)
    })
    .put("/:key/enrichment/bulk", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "external") return c.json({ error: "external_cruise_read_only" }, 409)
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      const payload = await parseJsonBody(
        c,
        replaceEnrichmentProgramsSchema.omit({ cruiseId: true }),
      )
      const rows = await cruisesService.replaceEnrichmentPrograms(c.get("db"), {
        cruiseId: parsed.id,
        programs: payload.programs,
      })
      return c.json({ data: rows })
    })
}

/**
 * Cruise content routes — sourced-aware detail endpoint.
 *
 *   GET /:key/content
 *
 * Returns the full `CruiseContent` payload for sourced cruises:
 * cache hit → cached row + overlay merge; cache miss with rich adapter
 * → adapter fetch + write-through; cache miss with thin adapter →
 * synthesizer fallback (sourced-content §3.3, §3.4, §3.6). When
 * `allowOwnedKeys` is enabled, owned `cru_*` ids are projected from the
 * cruises module's own tables.
 *
 * The cruise vertical's unified key parser (`<provider>:<ref>` for
 * external, plain TypeID for owned) is reused; this route accepts
 * either form. Plain owned TypeIDs require `allowOwnedKeys` so existing
 * sourced-only mounts can keep their previous contract.
 *
 * The catalog SourceAdapterRegistry is starter-owned and resolved via
 * the `resolveRegistry` callback. For cruise adapters wrapped via
 * `cruiseAdapterToSourceAdapter`, registry registration alongside the
 * cruise vertical's per-vertical registry enables both detail surfaces
 * (`/:key` for ad-hoc fetchCruise + `/:key/content` for cached
 * CruiseContent) without code duplication.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.3.
 */

import { OpenAPIHono } from "@hono/zod-openapi"
import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import type { Extension } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { HonoExtension } from "@voyant-travel/hono/module"
import type { Context } from "hono"

import {
  encodeSourceRef,
  isEncodedSourceEntityId,
  parseUnifiedKey,
  sourceRefFromExternalKeyRef,
} from "./lib/key.js"
import {
  type CruiseContentScope,
  getCruiseContent,
  getCruiseSailingPricing,
} from "./service-content.js"

export interface CruiseContentRoutesEnv {
  Variables: {
    db: AnyDrizzleDb
  }
}

export interface CreateCruiseContentRoutesOptions {
  resolveRegistry: (c: Context) => SourceAdapterRegistry
  onOverlayError?: (event: { field_path: string; reason: string }) => void
  defaultAcceptMachineTranslated?: boolean
  /**
   * When the unified key resolves to a cruise typeid (`cru_*` —
   * owned cruise), the route returns 404 by default. Set this to
   * `true` to also dispatch through `getCruiseContent` for owned ids
   * and let the service project content from owned cruise tables.
   */
  allowOwnedKeys?: boolean
}

export const CRUISE_CONTENT_OPENAPI_API_IDS = {
  admin: "@voyant-travel/cruises#content-extension.api.admin",
  public: "@voyant-travel/cruises#content-extension.api.public",
} as const

export function createCruiseContentRoutes(
  options: CreateCruiseContentRoutesOptions,
  apiId?: (typeof CRUISE_CONTENT_OPENAPI_API_IDS)[keyof typeof CRUISE_CONTENT_OPENAPI_API_IDS],
): OpenAPIHono<CruiseContentRoutesEnv> {
  const routes = new OpenAPIHono<CruiseContentRoutesEnv>()
  routes.get("/:key/content", async (c) => {
    const rawKey = c.req.param("key")
    const parsed = parseUnifiedKey(rawKey)

    if (parsed.kind === "invalid") {
      return c.json(
        {
          error: "invalid_key",
          detail: `Unrecognized cruise key: ${parsed.raw}`,
        },
        400,
      )
    }

    // A catalog sourced entity id (`crus_sr_<base64>`) is inherently sourced,
    // so it dispatches regardless of `allowOwnedKeys`. Only plain owned TypeIDs
    // (`cru_<base32>`) need the opt-in.
    const isSourcedEntityId = parsed.kind === "local" && isEncodedSourceEntityId(parsed.id)
    if (parsed.kind === "local" && !isSourcedEntityId && !options.allowOwnedKeys) {
      return c.json(
        {
          error: "owned_not_supported",
          detail: "GET /:key/content requires allowOwnedKeys to serve owned cruise content.",
        },
        404,
      )
    }

    // For external keys we resolve through the catalog sourced-entry
    // store via service-content. The cruise adapter must be registered
    // against the catalog SourceAdapterRegistry (typically via
    // cruiseAdapterToSourceAdapter) for this to find a row.
    const entityId = parsed.kind === "local" ? parsed.id : entityIdFromExternal(parsed)
    const scope = parseScope(c)
    const registry = options.resolveRegistry(c)

    const result = await getCruiseContent(c.var.db, entityId, scope, {
      registry,
      onOverlayError: options.onOverlayError,
    })

    if (!result) {
      return c.json(
        {
          error: "not_found",
          detail: `Cruise ${rawKey} (entity ${entityId}) has no public content. For sourced cruises, either no adapter is registered for this provider or discovery hasn't run yet. For owned cruises, no matching cruise row was found.`,
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

  for (const path of ["/{key}/content", "/{key}/sailings/{sailingExternalId}/pricing"] as const) {
    routes.openAPIRegistry.registerPath({
      method: "get",
      path,
      responses: { 200: { description: "Cruise content response." } },
      ...(apiId ? { "x-voyant-api-id": apiId } : {}),
    })
  }

  routes.get("/:key/sailings/:sailingExternalId/pricing", async (c) => {
    // Live per-sailing cabin pricing for the detail sheet's Departures tab.
    // Fetched fresh from the adapter (price is volatile-live), not cached.
    const rawKey = c.req.param("key")
    const parsed = parseUnifiedKey(rawKey)
    if (parsed.kind === "invalid") {
      return c.json({ error: "invalid_key", detail: `Unrecognized cruise key: ${parsed.raw}` }, 400)
    }
    const isSourcedEntityId = parsed.kind === "local" && isEncodedSourceEntityId(parsed.id)
    if (parsed.kind === "local" && !isSourcedEntityId && !options.allowOwnedKeys) {
      return c.json({ error: "owned_not_supported", detail: "Sourced cruises only." }, 404)
    }
    const entityId = parsed.kind === "local" ? parsed.id : entityIdFromExternal(parsed)
    const sailingExternalId = c.req.param("sailingExternalId")
    const pricing = await getCruiseSailingPricing(c.var.db, entityId, sailingExternalId, {
      registry: options.resolveRegistry(c),
    })
    if (pricing == null) {
      return c.json(
        {
          error: "not_found",
          detail: `No pricing for sailing ${sailingExternalId} on cruise ${rawKey} (no sourced row or adapter can't price sailings).`,
        },
        404,
      )
    }
    return c.json({ data: { pricing } })
  })

  function parseScope(c: Context): CruiseContentScope {
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

  return routes
}

export interface CruiseContentHonoExtensionOptions {
  admin: CreateCruiseContentRoutesOptions
  public: CreateCruiseContentRoutesOptions
}

export const cruiseContentExtension: Extension = {
  name: "content",
  module: "cruises",
}

/** Build sourced-aware cruise content routes for both API surfaces. */
export function createCruiseContentHonoExtension(
  options: CruiseContentHonoExtensionOptions,
): HonoExtension {
  return {
    extension: cruiseContentExtension,
    adminRoutes: createCruiseContentRoutes(options.admin, CRUISE_CONTENT_OPENAPI_API_IDS.admin),
    publicRoutes: createCruiseContentRoutes(options.public, CRUISE_CONTENT_OPENAPI_API_IDS.public),
  }
}

/**
 * Translate a parsed external key (`<provider>:<ref>`) into the catalog-side
 * entity_id. Mirrors the default `buildEntityId` from
 * `cruiseAdapterToSourceAdapter`: `crus_<encoded SourceRef>`.
 */
function entityIdFromExternal(
  parsed: Extract<ReturnType<typeof parseUnifiedKey>, { kind: "external" }>,
): string {
  return `crus_${encodeSourceRef(sourceRefFromExternalKeyRef(parsed.ref))}`
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

export type CruiseContentRoutes = ReturnType<typeof createCruiseContentRoutes>

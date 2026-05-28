/**
 * Cruise content routes — sourced-aware detail endpoint.
 *
 *   GET /:key/content
 *
 * Returns the full `CruiseContent` payload for a sourced cruise:
 * cache hit → cached row + overlay merge; cache miss with rich adapter
 * → adapter fetch + write-through; cache miss with thin adapter →
 * synthesizer fallback (sourced-content §3.3, §3.4, §3.6).
 *
 * The cruise vertical's unified key parser (`<provider>:<ref>` for
 * external, plain TypeID for owned) is reused; this route accepts
 * either form. Owned cruises return 404 — they have no sourced-entry
 * row. Owned-cruise detail uses the existing `/:key` route.
 *
 * The catalog SourceAdapterRegistry is template-owned and resolved via
 * the `resolveRegistry` callback. For cruise adapters wrapped via
 * `cruiseAdapterToSourceAdapter`, registry registration alongside the
 * cruise vertical's per-vertical registry enables both detail surfaces
 * (`/:key` for ad-hoc fetchCruise + `/:key/content` for cached
 * CruiseContent) without code duplication.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.3.
 */

import type { SourceAdapterRegistry } from "@voyantjs/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyantjs/db"
import type { Context } from "hono"
import { Hono } from "hono"

import { encodeSourceRef, parseUnifiedKey, sourceRefFromExternalKeyRef } from "./lib/key.js"
import { type CruiseContentScope, getCruiseContent } from "./service-content.js"

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
   * When the unified key resolves to a cruise typeid (`crus_*` —
   * owned cruise), the route returns 404 by default. Set this to
   * `true` to also dispatch through `getCruiseContent` for owned ids
   * (useful when an owned cruise also has a sourced-entry row, e.g.
   * after a detach + re-import workflow).
   */
  allowOwnedKeys?: boolean
}

export function createCruiseContentRoutes(
  options: CreateCruiseContentRoutesOptions,
): Hono<CruiseContentRoutesEnv> {
  return new Hono<CruiseContentRoutesEnv>().get("/:key/content", async (c) => {
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

    if (parsed.kind === "local" && !options.allowOwnedKeys) {
      return c.json(
        {
          error: "owned_not_supported",
          detail:
            "GET /:key/content serves sourced cruises only. Owned cruises use GET /:key. Set allowOwnedKeys: true on the route factory to opt into owned dispatch.",
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
          detail: `Cruise ${rawKey} (entity ${entityId}) has no sourced-content row. Either no adapter is registered for this provider, or discovery hasn't run yet.`,
        },
        404,
      )
    }

    return c.json({
      data: {
        content: result.content,
        served_locale: result.resolution.served_locale,
        match_kind: result.resolution.match_kind,
        source: result.source,
        served_stale: result.served_stale,
        synthesized: result.synthesized,
        machine_translated: result.machine_translated,
      },
    })
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

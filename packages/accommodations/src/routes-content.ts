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

import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import type { Extension } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { HonoExtension } from "@voyant-travel/hono/module"
import type { Context } from "hono"
import { Hono } from "hono"

import { type AccommodationContentScope, getAccommodationContent } from "./service-content.js"

export interface AccommodationContentRoutesEnv {
  Variables: {
    db: AnyDrizzleDb
  }
}

export interface CreateAccommodationContentRoutesOptions {
  resolveRegistry: (c: Context) => SourceAdapterRegistry
  onOverlayError?: (event: { field_path: string; reason: string }) => void
  defaultAcceptMachineTranslated?: boolean
}

export function createAccommodationContentRoutes(
  options: CreateAccommodationContentRoutesOptions,
): Hono<AccommodationContentRoutesEnv> {
  return new Hono<AccommodationContentRoutesEnv>().get("/:id/content", async (c) => {
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

export interface AccommodationContentHonoExtensionOptions {
  admin: CreateAccommodationContentRoutesOptions
  public: CreateAccommodationContentRoutesOptions
}

export const accommodationContentExtension: Extension = {
  name: "content",
  module: "accommodations",
}

/** Build accommodation content routes for operator and storefront callers. */
export function createAccommodationContentHonoExtension(
  options: AccommodationContentHonoExtensionOptions,
): HonoExtension {
  return {
    extension: accommodationContentExtension,
    adminRoutes: createAccommodationContentRoutes(options.admin),
    publicRoutes: createAccommodationContentRoutes(options.public),
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

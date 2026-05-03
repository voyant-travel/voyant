/**
 * Product content routes — sourced-aware detail endpoint.
 *
 *   GET /:id/content
 *
 * Returns the full `ProductContent` payload for a sourced product:
 * cache hit → cached row + overlay merge; cache miss with rich adapter
 * → adapter fetch + write-through; cache miss with thin adapter →
 * synthesizer fallback (sourced-content §3.3, §3.4, §3.6).
 *
 * Owned products return 404 from this route — they have no
 * sourced-entry row. Owned-product detail reads use the existing
 * `/:id` route (via `productsService`); the read-aware dispatch unifying
 * owned vs. sourced is the natural follow-up once the operator UI
 * adopts a unified shape.
 *
 * Templates mount this router under their preferred prefix; the
 * factory takes a `resolveRegistry` callback so the catalog
 * `SourceAdapterRegistry` stays template-owned (singleton lifetime,
 * adapters carry HTTP clients).
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.3.
 */

import type { SourceAdapterRegistry } from "@voyantjs/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyantjs/db"
import type { Context } from "hono"
import { Hono } from "hono"

import { getProductContent, type ProductContentScope } from "./service-content.js"

export interface ProductContentRoutesEnv {
  Variables: {
    db: AnyDrizzleDb
  }
}

export interface CreateProductContentRoutesOptions {
  /**
   * Resolve the catalog `SourceAdapterRegistry` for the current
   * request. Templates typically return a process-local singleton
   * built lazily from env (mirroring the booking-engine registry
   * pattern).
   */
  resolveRegistry: (c: Context) => SourceAdapterRegistry
  /**
   * Optional sink for overlay-merge diagnostics. When set, called
   * once per overlay that fails to apply. Defaults to silent (the
   * read still succeeds; the bad overlay is skipped).
   */
  onOverlayError?: (event: { field_path: string; reason: string }) => void
  /**
   * Optional override for `acceptMachineTranslated`. Defaults to
   * `true` — storefront-friendly. Operator surfaces typically set
   * `false` so ops sees authored content before deciding to override.
   */
  defaultAcceptMachineTranslated?: boolean
}

/**
 * Build the product content router. Returns a Hono instance that
 * exposes a single `GET /:id/content` route. Templates mount it under
 * `/v1/admin/products` or `/v1/public/products` as appropriate.
 */
export function createProductContentRoutes(
  options: CreateProductContentRoutesOptions,
): Hono<ProductContentRoutesEnv> {
  return new Hono<ProductContentRoutesEnv>().get("/:id/content", async (c) => {
    const entityId = c.req.param("id")
    const scope = parseScope(c)
    const registry = options.resolveRegistry(c)

    const result = await getProductContent(c.var.db, entityId, scope, {
      registry,
      onOverlayError: options.onOverlayError,
    })

    if (!result) {
      return c.json(
        {
          error: "not_found",
          detail: `Product ${entityId} has no sourced-content row. Owned products use GET /:id; unknown ids return this 404.`,
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

  function parseScope(c: Context): ProductContentScope {
    // Locale priority: explicit query param > Accept-Language header
    // > en-GB fallback. Multiple `?locale=` query params are joined
    // into the preference chain.
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
 * Parse an `Accept-Language` header into an ordered list of BCP 47
 * tags. Quality factors are honored — higher-q first; ties keep
 * insertion order. Lifted out of the route handler so it's testable
 * in isolation.
 */
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

export type ProductContentRoutes = ReturnType<typeof createProductContentRoutes>

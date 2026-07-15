/**
 * Product content routes — unified owned + sourced detail endpoint.
 *
 *   GET /:id/content
 *
 * Returns the full `ProductContent` payload for ANY product:
 *   - **Sourced**: cache hit → cached row + overlay merge; cache miss
 *     with rich adapter → adapter fetch + write-through; cache miss
 *     with thin adapter → synthesizer fallback (sourced-content §3.3,
 *     §3.4, §3.6).
 *   - **Owned**: read from the products module's own tables and
 *     project to ProductContent. Overlay merge applies the same way.
 *     Marked `source: "owned"` in the response.
 *
 * 404 only when the entity doesn't exist (no sourced-entry row AND
 * no owned product row). The catalog detail sheet calls this on
 * click to enrich the indexed projection with itinerary, media,
 * options, and policies.
 *
 * Templates mount this router under their preferred prefix; the
 * factory takes a `resolveRegistry` callback so the catalog
 * `SourceAdapterRegistry` stays starter-owned (singleton lifetime,
 * adapters carry HTTP clients).
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.3.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import type { Extension } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { ApiExtension } from "@voyant-travel/hono/module"
import { productContentSchema } from "@voyant-travel/products-contracts/content-shape"
import type { Context } from "hono"

import { getProductContent, type ProductContentScope } from "./service-content.js"

const contentProvenanceSchema = z.object({
  source_kind: z.string(),
  source_provider: z.string().optional(),
  source_connection_id: z.string().optional(),
  source_ref: z.string().optional(),
})

const contentResponseSchema = z.object({
  data: z.object({
    content: productContentSchema,
    provenance: contentProvenanceSchema,
    served_locale: z.string(),
    match_kind: z.enum(["exact", "language_match", "fallback_chain", "any"]),
    source: z.enum(["sourced-cache", "sourced-fresh", "synthesized", "owned"]),
    served_stale: z.boolean(),
    synthesized: z.boolean(),
    machine_translated: z.boolean(),
  }),
})

const contentNotFoundSchema = z.object({ error: z.string(), detail: z.string() })

/**
 * Locale/market/currency preferences are read out of the query string and the
 * `Accept-Language` header by `parseScope` (priority chain), so they are not
 * declared as a validated query schema here — only the `{id}` path param is
 * validated. The response carries the resolved `ProductContent` plus locale +
 * freshness metadata.
 */
const getProductContentRoute = createRoute({
  method: "get",
  path: "/{id}/content",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Resolved product content with locale + freshness metadata",
      content: { "application/json": { schema: contentResponseSchema } },
    },
    404: {
      description: "Product not found (no owned row + no sourced-entry row)",
      content: { "application/json": { schema: contentNotFoundSchema } },
    },
  },
})

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
 * Build the product content router. Returns an `OpenAPIHono` instance that
 * exposes a single `GET /{id}/content` route. Templates mount it under
 * `/v1/admin/products` or `/v1/public/products` as appropriate.
 */
export function createProductContentRoutes(
  options: CreateProductContentRoutesOptions,
): OpenAPIHono<ProductContentRoutesEnv> {
  return new OpenAPIHono<ProductContentRoutesEnv>({
    defaultHook: openApiValidationHook,
  }).openapi(getProductContentRoute, async (c) => {
    const entityId = c.req.valid("param").id
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
          detail: `Product ${entityId} not found (no owned row + no sourced-entry row).`,
        },
        404,
      )
    }

    return c.json(
      {
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
      },
      200,
    )
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

export interface ProductContentApiExtensionOptions {
  admin: CreateProductContentRoutesOptions
  public: CreateProductContentRoutesOptions
}

export const productContentExtension: Extension = {
  name: "content",
  module: "products",
}

/** Build the product content routes for both operator and storefront surfaces. */
export function createProductContentApiExtension(
  options: ProductContentApiExtensionOptions,
): ApiExtension {
  return {
    extension: productContentExtension,
    adminRoutes: createProductContentRoutes(options.admin),
    publicRoutes: createProductContentRoutes(options.public),
  }
}

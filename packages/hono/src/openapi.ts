import type { OpenAPIHono } from "@hono/zod-openapi"
import type { Hono } from "hono"

/**
 * OpenAPI document generation for composed Voyant apps (voyant#2114).
 *
 * The app returned by `createApp`/`mountApp` is an `OpenAPIHono` under the hood
 * (typed as `Hono` for callers), so the helpers here cast to reach
 * `getOpenAPIDocument`. Only routes authored via `createRoute(...).openapi(...)`
 * contribute operations — plain routes are absent until migrated.
 *
 * Import these from `@voyant-travel/hono/openapi`, never from the package
 * barrel: `getOpenAPIDocument` pulls in `@asteasolutions/zod-to-openapi`, which
 * must stay out of the Worker runtime bundle. This module is meant for
 * build-time generation only.
 */

export interface OpenApiInfo {
  title: string
  version: string
  description?: string
  /** OpenAPI spec extension fields (`x-*`), matching the doc's `InfoObject`. */
  [extension: `x-${string}`]: unknown
}

export interface OpenApiServer {
  url: string
  description?: string
  [extension: `x-${string}`]: unknown
}

export interface GenerateOpenApiOptions {
  info: OpenApiInfo
  servers?: OpenApiServer[]
}

// biome-ignore lint/suspicious/noExplicitAny: accepts any composed app, regardless of its Env/Schema/BasePath; narrowed to OpenAPIHono below.
type AnyApp = Hono<any, any, any>

/**
 * An OpenAPI 3.1 document, as produced by `OpenAPIHono`. Named via the direct
 * dependency's method type so the inferred type stays portable (TS2883).
 */
export type OpenApiDocument = ReturnType<OpenAPIHono["getOpenAPI31Document"]>

/**
 * Generate a single OpenAPI 3.1 document covering every `.openapi()` route
 * mounted on the composed app, with module base paths already merged in
 * (honojs/middleware#952).
 */
export function generateOpenApiDocument(
  app: AnyApp,
  options: GenerateOpenApiOptions,
): OpenApiDocument {
  // The composed app is an `OpenAPIHono` (built in `mountApp`) presented to
  // callers as `Hono`; this build-time seam narrows it back to read the doc.
  const oapi = app as OpenAPIHono
  return oapi.getOpenAPI31Document({
    openapi: "3.1.0",
    info: options.info,
    ...(options.servers ? { servers: options.servers } : {}),
  })
}

/**
 * Voyant's two published API surfaces, keyed by path prefix. Admin routes mount
 * under `/v1/admin/*` and storefront/public routes under `/v1/public/*`; the
 * legacy `/v1/*` surface is intentionally excluded from the published docs.
 */
export type ApiSurface = "admin" | "storefront"

const SURFACE_PREFIX: Record<ApiSurface, string> = {
  admin: "/v1/admin",
  storefront: "/v1/public",
}

/**
 * Narrow a composed document to a single surface by path prefix, producing the
 * `framework-admin` / `framework-storefront` documents that replace the
 * hand-authored specs. Components are carried over verbatim (the generator may
 * over-include shared component schemas, which is harmless).
 */
export function selectSurface(doc: OpenApiDocument, surface: ApiSurface): OpenApiDocument {
  const prefix = SURFACE_PREFIX[surface]
  const paths = Object.fromEntries(
    Object.entries(doc.paths ?? {}).filter(([path]) => path.startsWith(prefix)),
  )
  return { ...doc, paths }
}

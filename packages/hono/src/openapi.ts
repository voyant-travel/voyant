import { OpenAPIHono } from "@hono/zod-openapi"
import type { Hono } from "hono"

import type { LazyRoutesLoader } from "./lazy-routes.js"

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

/**
 * A lazy-mounted route family recorded by `mountApp` for build-time spec
 * merging. `prefix` is the absolute surface mount (`/v1/admin/<name>`,
 * `/v1/public/...`) for relative-route loaders, or `"/"` for absolute
 * `lazyRoutes` loaders. `load` is the same loader the runtime dispatcher caches
 * — it constructs (but does not serve) the sub-app via `import(...)`.
 */
export interface LazyMount {
  prefix: string
  load: LazyRoutesLoader
}

/** Detect an `OpenAPIHono` sub-app (carries the `.openapi()` route registry). */
function isOpenApiHono(value: unknown): value is OpenAPIHono {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { getOpenAPI31Document?: unknown }).getOpenAPI31Document === "function" &&
    "openAPIRegistry" in value
  )
}

/**
 * Eager-merge lazy route families into a generated base document (voyant#2114).
 *
 * Lazy families mount at runtime as wildcard dispatch stubs (see
 * `lazy-routes.ts`), so their `.openapi()` operations never reach the composed
 * `OpenAPIHono` registry and are invisible to `generateOpenApiDocument`. This
 * runs each loader at build time, and for any that return an `OpenAPIHono`,
 * re-mounts it into a throwaway `OpenAPIHono` at its real prefix — reusing the
 * exact prefix-merge semantics `OpenAPIHono.route(...)` applies to eager mounts
 * — then shallow-merges the resulting `paths` + `components.*` into `base`.
 *
 * Plain `Hono` sub-apps (no `.openapi()` routes) carry no registry and are
 * skipped without error. A loader that throws is skipped with a warning so one
 * bad family can't break generation. `base` wins on path/component collisions
 * (which shouldn't happen given distinct prefixes), with a dev-time warning.
 *
 * Build-time only — same module-level constraint as the rest of this file
 * (`@asteasolutions/zod-to-openapi` stays out of the Worker bundle).
 */
export async function mergeLazyOpenApiPaths(
  base: OpenApiDocument,
  mounts: readonly LazyMount[],
  options: GenerateOpenApiOptions,
): Promise<OpenApiDocument> {
  const throwaway = new OpenAPIHono()
  let mergedAny = false

  for (const { prefix, load } of mounts) {
    let subApp: unknown
    try {
      subApp = await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[voyant] openapi: lazy loader for "${prefix}" failed, skipping: ${message}`)
      continue
    }
    if (!isOpenApiHono(subApp)) {
      // Plain Hono (or anything without the registry) contributes no docs.
      continue
    }
    // `route("/", subApp)` reproduces what an absolute-path (`lazyRoutes`)
    // family does at runtime; a relative-surface loader merges at its prefix.
    throwaway.route(prefix === "/" ? "/" : prefix, subApp)
    mergedAny = true
  }

  if (!mergedAny) return base

  const lazyDoc = throwaway.getOpenAPI31Document({
    openapi: "3.1.0",
    info: options.info,
    ...(options.servers ? { servers: options.servers } : {}),
  })

  const paths: Record<string, unknown> = { ...(base.paths ?? {}) }
  for (const [path, item] of Object.entries(lazyDoc.paths ?? {})) {
    if (path in paths) {
      console.warn(
        `[voyant] openapi: lazy path "${path}" collides with an eager route; keeping eager.`,
      )
      continue
    }
    paths[path] = item
  }

  const merged: OpenApiDocument = { ...base, paths } as OpenApiDocument

  const lazyComponents = lazyDoc.components
  if (lazyComponents) {
    const baseComponents = (base.components ?? {}) as Record<string, Record<string, unknown>>
    const mergedComponents: Record<string, Record<string, unknown>> = {}
    const groups = new Set([...Object.keys(baseComponents), ...Object.keys(lazyComponents)])
    for (const group of groups) {
      const baseGroup = (baseComponents[group] ?? {}) as Record<string, unknown>
      const lazyGroup = (lazyComponents as Record<string, Record<string, unknown>>)[group] ?? {}
      const combined: Record<string, unknown> = { ...lazyGroup }
      for (const [key, value] of Object.entries(baseGroup)) {
        combined[key] = value // base wins
      }
      mergedComponents[group] = combined
    }
    ;(merged as { components?: unknown }).components = mergedComponents
  }

  return merged
}

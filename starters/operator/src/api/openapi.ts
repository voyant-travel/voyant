import {
  generateModuleOpenApiDocuments,
  generateOpenApiDocument,
  mergeLazyOpenApiPaths,
  type OpenApiDocument,
  selectSurface,
} from "@voyant-travel/hono/openapi"
import { app } from "./app.js"

const OPENAPI_INFO = {
  title: "Voyant Operator API",
  version: "0.0.0",
  description: "Generated from the composed operator app. Do not edit by hand.",
} as const

/**
 * Build-time OpenAPI generation for the operator deployment (voyant#2114).
 *
 * The composed `app` is an `OpenAPIHono`, so every module route authored via
 * `createRoute(...).openapi(...)` contributes an operation here — at its real
 * composed path, base-path included. The two published surfaces are derived by
 * prefix: `framework-admin` (`/v1/admin/*`) and `framework-storefront`
 * (`/v1/public/*`). Legacy `/v1/*` routes appear only in `full`.
 *
 * This is the source of truth that replaces the hand-authored specs. It is
 * imported by the generator script + the drift test — never by the Worker
 * entrypoint, so the doc generator stays out of the runtime bundle.
 */
export interface OperatorOpenApiDocuments {
  full: OpenApiDocument
  admin: OpenApiDocument
  storefront: OpenApiDocument
  /**
   * One self-contained document per module (voyant#2733), generated from each
   * module's own registered routes rather than split from the aggregate — so
   * `openapi/{admin,storefront}/<module>.json` stays browsable and diffable
   * where the multi-megabyte aggregate is neither.
   */
  modules: Map<string, OpenApiDocument>
}

export async function buildOperatorOpenApiDocuments(): Promise<OperatorOpenApiDocuments> {
  const options = { info: OPENAPI_INFO }
  const eager = generateOpenApiDocument(app, options)
  // Lazy route families mount as wildcard dispatch stubs at runtime, so their
  // `.openapi()` operations never reach the composed registry — replay their
  // loaders at build time and merge any documented routes (voyant#2114).
  const full = await mergeLazyOpenApiPaths(eager, app.lazyMounts ?? [], options)
  const modules = await generateModuleOpenApiDocuments(app.moduleMounts ?? [], options)
  return {
    full,
    admin: selectSurface(full, "admin"),
    storefront: selectSurface(full, "storefront"),
    modules,
  }
}

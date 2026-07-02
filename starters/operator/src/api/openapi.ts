import {
  buildModulePathOwnership,
  type GenerateOpenApiOptions,
  generateOpenApiDocument,
  mergeLazyOpenApiPaths,
  type OpenApiDocument,
  partitionByModule,
  selectSurface,
  stampModuleMetadata,
} from "@voyant-travel/hono/openapi"
import { app } from "./app.js"

const OPENAPI_OPTIONS: GenerateOpenApiOptions = {
  info: {
    title: "Voyant Operator API",
    version: "0.0.0",
    description: "Generated from the composed operator app. Do not edit by hand.",
  },
  // Relative server so Swagger/Scalar "try it out" targets this deployment's
  // own origin (voyant#2729).
  servers: [{ url: "/", description: "This deployment (same origin)" }],
}

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
  const options = OPENAPI_OPTIONS
  const eager = generateOpenApiDocument(app, options)
  // Lazy route families mount as wildcard dispatch stubs at runtime, so their
  // `.openapi()` operations never reach the composed registry — replay their
  // loaders at build time and merge any documented routes (voyant#2114).
  const merged = await mergeLazyOpenApiPaths(eager, app.lazyMounts ?? [], options)
  // Build the path→module map once, stamp the aggregate with `x-voyant-module` /
  // `x-voyant-surface` (derived docs inherit it), then partition the FULL surface
  // so `additionalRoutes` (e.g. the workflow-runs admin surface) and
  // directly-mounted routes aren't dropped.
  const owner = await buildModulePathOwnership(app.moduleMounts ?? [], options)
  const full = stampModuleMetadata(merged, owner)
  return {
    full,
    admin: selectSurface(full, "admin"),
    storefront: selectSurface(full, "storefront"),
    modules: partitionByModule(full, owner),
  }
}

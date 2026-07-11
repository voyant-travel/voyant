import { buildSelectedGraphOpenApiDocuments } from "@voyant-travel/framework/selected-graph-openapi"
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
import { createGeneratedGraphRuntime } from "../../.voyant/runtime/graph-runtime.generated"
import { app } from "./app.js"

const OPENAPI_HTTP_METHODS = new Set([
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "trace",
])

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
  const compatibilityModules = partitionByModule(full, owner)
  const graphModules = await buildSelectedGraphOpenApiDocuments({
    runtime: createGeneratedGraphRuntime(),
    app,
    options,
  })
  return {
    full,
    admin: selectSurface(full, "admin"),
    storefront: selectSurface(full, "storefront"),
    modules: mergeOperatorOpenApiModuleDocuments(compatibilityModules, graphModules),
  }
}

/** Replace migrated compatibility documents only after proving contract parity. */
export function mergeOperatorOpenApiModuleDocuments(
  compatibility: ReadonlyMap<string, OpenApiDocument>,
  graph: ReadonlyMap<string, OpenApiDocument>,
): Map<string, OpenApiDocument> {
  const graphPathOwners = new Map<string, string>()
  for (const [document, graphDocument] of graph) {
    for (const path of Object.keys(graphDocument.paths ?? {})) {
      const existing = graphPathOwners.get(path)
      if (existing) {
        throw new Error(
          `Selected graph OpenAPI path "${path}" is owned by both "${existing}" and "${document}".`,
        )
      }
      graphPathOwners.set(path, document)
    }
  }

  const merged = new Map<string, OpenApiDocument>()
  for (const [document, compatibilityDocument] of compatibility) {
    const paths = Object.fromEntries(
      Object.entries(compatibilityDocument.paths ?? {}).filter(
        ([path]) => !graphPathOwners.has(path),
      ),
    )
    if (Object.keys(paths).length > 0) {
      merged.set(document, { ...compatibilityDocument, paths } as OpenApiDocument)
    }
  }

  for (const [document, graphDocument] of graph) {
    const compatibilityDocument = compatibility.get(document)
    if (compatibilityDocument) {
      const graphOperations = documentOperationKeys(graphDocument)
      const missing = [...documentOperationKeys(compatibilityDocument)].filter(
        (operation) => !graphOperations.has(operation),
      )
      if (missing.length > 0) {
        throw new Error(
          `Selected graph OpenAPI document "${document}" does not preserve compatibility operations: ${missing.join(", ")}.`,
        )
      }
    }

    merged.set(document, graphDocument)
  }
  return merged
}

function documentOperationKeys(document: OpenApiDocument): Set<string> {
  const operations = new Set<string>()
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    if (!pathItem || typeof pathItem !== "object") continue
    for (const method of Object.keys(pathItem)) {
      if (OPENAPI_HTTP_METHODS.has(method.toLowerCase()))
        operations.add(`${method.toUpperCase()} ${path}`)
    }
  }
  return operations
}

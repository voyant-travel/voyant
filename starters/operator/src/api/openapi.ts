import {
  buildSelectedGraphOpenApiDocuments,
  mergeSelectedGraphOpenApiDocuments,
} from "@voyant-travel/framework/selected-graph-openapi"
import {
  type GenerateOpenApiOptions,
  type OpenApiDocument,
  selectSurface,
} from "@voyant-travel/hono/openapi"
import { createGeneratedGraphRuntime } from "../../.voyant/runtime/graph-runtime.generated"
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
 * Selected package API facets name their documents. Framework lowering matches
 * those claims against the composed app and fails any unclaimed or duplicate
 * published operation. The aggregate is the union of those selected documents.
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
   * One self-contained document per selected graph document claim.
   */
  modules: Map<string, OpenApiDocument>
}

export async function buildOperatorOpenApiDocuments(): Promise<OperatorOpenApiDocuments> {
  const options = OPENAPI_OPTIONS
  const modules = await buildSelectedGraphOpenApiDocuments({
    runtime: createGeneratedGraphRuntime(),
    app,
    options,
  })
  const full = mergeSelectedGraphOpenApiDocuments(modules)
  return {
    full,
    admin: selectSurface(full, "admin"),
    storefront: selectSurface(full, "storefront"),
    modules,
  }
}

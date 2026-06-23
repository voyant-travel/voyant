import { generateOpenApiDocument, selectSurface } from "@voyant-travel/hono/openapi"
import { app } from "./app.js"

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
export function buildOperatorOpenApiDocuments() {
  const full = generateOpenApiDocument(app, {
    info: {
      title: "Voyant Operator API",
      version: "0.0.0",
      description: "Generated from the composed operator app. Do not edit by hand.",
    },
  })
  return {
    full,
    admin: selectSurface(full, "admin"),
    storefront: selectSurface(full, "storefront"),
  }
}

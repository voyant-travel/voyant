/**
 * Operator (deployment) wiring for the media routes.
 *
 * The route SHAPES live in packages:
 *   - upload + serve in `@voyant-travel/storage` (`createMediaHonoModule`),
 *   - product brochure generation in `@voyant-travel/inventory`
 *     (`createProductBrochureRoutes`).
 *
 * Package-owned standard Node runtimes now supply provider policy. This file is
 * only a compatibility facade for callers that have not yet switched to graph
 * runtime factories.
 */

import { OpenAPIHono } from "@hono/zod-openapi"
import { createProductBrochureRoutes } from "@voyant-travel/inventory/routes-brochure"
import { createInventoryBrochureStandardNodeRuntime } from "@voyant-travel/inventory/standard-node/brochure-runtime"
import { createMediaHonoModule } from "@voyant-travel/storage/routes"
import { createStorageStandardNodeRuntime } from "@voyant-travel/storage/standard-node"

const directEnvPrimitives = {
  env: (bindings: unknown) => bindings as Readonly<Record<string, unknown>>,
}

export const operatorStorageMediaRuntime = createStorageStandardNodeRuntime(directEnvPrimitives)

/** Build the upload + serve routes (`/v1/admin/uploads`, `/v1/admin/media/*`, …). */
function buildMediaUploadAndServeModule() {
  return createMediaHonoModule(operatorStorageMediaRuntime)
}

/** Build the brochure route (`/v1/admin/products/:id/brochure/generate`). */
export const operatorInventoryBrochureRuntime =
  createInventoryBrochureStandardNodeRuntime(directEnvPrimitives)

function buildBrochureRoutes() {
  return createProductBrochureRoutes(operatorInventoryBrochureRuntime)
}

/**
 * Compatibility composition for the former combined operator media surface.
 * Storage upload/serve and inventory brochure generation now have separate
 * package ownership, while this loader preserves the existing mounted routes.
 */
export async function buildOperatorStorageRoutes(): Promise<OpenAPIHono> {
  const app = new OpenAPIHono()
  app.route("/", await buildMediaUploadAndServeModule().lazyRoutes.load())
  return app
}

export async function buildOperatorInventoryBrochureRoutes(): Promise<OpenAPIHono> {
  // OpenAPIHono parent so the brochure-generation sub-app's `.openapi()` def
  // (`POST /v1/admin/products/{id}/brochure/generate`) surfaces in the operator
  // spec via the build-time lazy-merge — `mergeLazyOpenApiPaths` skips plain
  // `Hono` wrappers, which carry no registry (voyant#2114). The upload + binary
  // serve routes from `@voyant-travel/storage` stay plain `Hono` (multipart /
  // wildcard byte streams), so they remain undocumented.
  const app = new OpenAPIHono()
  app.route("/v1/admin/products", buildBrochureRoutes())
  return app
}

export async function buildOperatorMediaRoutes(): Promise<OpenAPIHono> {
  const app = await buildOperatorStorageRoutes()
  app.route("/v1/admin/products", buildBrochureRoutes())
  return app
}

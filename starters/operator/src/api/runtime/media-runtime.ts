/**
 * Operator (deployment) wiring for the media routes.
 *
 * The route SHAPES live in packages:
 *   - upload + serve in `@voyant-travel/storage` (`createMediaHonoModule`),
 * Package-owned runtimes now supply provider policy. This file is only a
 * compatibility facade for storage callers that have not yet switched to the
 * graph runtime factory.
 */

import { OpenAPIHono } from "@hono/zod-openapi"
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

/**
 * Compatibility composition for the package-owned Storage surface.
 */
export async function buildOperatorStorageRoutes(): Promise<OpenAPIHono> {
  const app = new OpenAPIHono()
  app.route("/", await buildMediaUploadAndServeModule().lazyRoutes.load())
  return app
}

export async function buildOperatorMediaRoutes(): Promise<OpenAPIHono> {
  return buildOperatorStorageRoutes()
}

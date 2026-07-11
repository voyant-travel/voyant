/**
 * Operator (deployment) wiring for the media routes.
 *
 * The route SHAPES live in packages:
 *   - upload + serve in `@voyant-travel/storage` (`createMediaHonoModule`),
 *   - product brochure generation in `@voyant-travel/inventory`
 *     (`createProductBrochureRoutes`).
 *
 * This file supplies the deployment-specific access those packages can't import
 * statically:
 *   - the R2-backed `StorageProvider` (`./lib/storage` → `createMediaStorage`),
 *   - the video upload ticket signer (`../lib/video-uploads`),
 *   - the Voyant Cloud browser printer for brochures (`../lib/brochure-printer`,
 *     only when Cloud is configured).
 *
 * Swapping storage backends, the video provider, or the brochure printer is a
 * change here — never in the route implementations.
 */

import { OpenAPIHono } from "@hono/zod-openapi"
import { createProductBrochureRoutes } from "@voyant-travel/inventory/routes-brochure"
import { createMediaHonoModule, type VideoUploadTicketRequest } from "@voyant-travel/storage/routes"
import type { Context } from "hono"

import { createProductBrochurePrinter } from "../../lib/brochure-printer"
import { createVideoUploadTicket } from "../../lib/video-uploads"
import { tryGetCloudClient } from "../../lib/voyant-cloud"
import { createMediaStorage, guessMimeType } from "../lib/storage"

export const operatorStorageMediaRuntime = {
  resolveStorage: (c: Context) => createMediaStorage(c.env),
  guessServedMimeType: guessMimeType,
  signVideoUploadTicket: (c: Context, input: VideoUploadTicketRequest) =>
    createVideoUploadTicket(c.env, input),
}

/** Resolve the R2-backed media storage provider for a request (or null → 503). */
function resolveStorage(c: Context) {
  return createMediaStorage(c.env)
}

/** Build the upload + serve routes (`/v1/admin/uploads`, `/v1/admin/media/*`, …). */
function buildMediaUploadAndServeModule() {
  return createMediaHonoModule(operatorStorageMediaRuntime)
}

/** Build the brochure route (`/v1/admin/products/:id/brochure/generate`). */
function buildBrochureRoutes() {
  return createProductBrochureRoutes({
    resolveStorage,
    // Use the Voyant Cloud browser printer only when Cloud is configured;
    // otherwise the task falls back to its built-in pdf-lib printer.
    resolvePrinter: (c: Context) =>
      tryGetCloudClient(c.env) ? createProductBrochurePrinter(c.env) : null,
  })
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

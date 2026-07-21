/**
 * Product brochure generation route, owned by `@voyant-travel/inventory`.
 *
 *   POST /:id/brochure/generate   — generate + store a product brochure PDF
 *
 * The route registers a RELATIVE path; a deployment mounts the returned `Hono`
 * at `/v1/admin/products`. The brochure task (`generateAndStoreProductBrochure`)
 * already lives in this package; this factory only wires it to an HTTP surface.
 *
 * The deployment supplies the storage-backed specifics via `options`:
 *   - `resolveStorage(c)` — the selected `StorageProvider` to upload into (or
 *     `null` when storage isn't configured → 503),
 *   - `resolvePrinter(c)` — an optional PDF printer (e.g. a browser-rendering
 *     service); when omitted the default pdf-lib printer is used,
 *   - `template` / `keyPrefix` / `maxSizeBytes` overrides.
 *
 * Keeping these injected means inventory never imports a deployment storage
 * binding or cloud client.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { Extension } from "@voyant-travel/core"
import { idempotencyKey, openApiValidationHook } from "@voyant-travel/hono"
import type { ApiExtension } from "@voyant-travel/hono/module"
import type { StorageProvider } from "@voyant-travel/storage"
import type { Context } from "hono"

import { emitProductContentChanged } from "./events.js"
import type { Env } from "./route-env.js"
import {
  createDefaultProductBrochureTemplate,
  generateAndStoreProductBrochure,
  PRODUCT_BROCHURE_STORAGE_ERROR_MESSAGE,
  type ProductBrochurePrinter,
  ProductBrochureStorageError,
  type ProductBrochureTemplateDefinition,
} from "./tasks/index.js"

/** 5 MiB cap on a generated brochure PDF before it's rejected with 413. */
const DEFAULT_MAX_BROCHURE_PDF_BYTES = 5 * 1024 * 1024

const errorResponseSchema = z.object({ error: z.string() })

/**
 * Generated-brochure row schema, authored from the `product_media`
 * `$inferSelect` shape (the brochure is persisted via `upsertBrochure`). §17:
 * timestamp columns serialize to strings over the wire.
 */
const brochureMediaSchema = z.object({
  id: z.string(),
  productId: z.string(),
  dayId: z.string().nullable(),
  mediaType: z.enum(["image", "video", "document"]),
  name: z.string(),
  url: z.string(),
  storageKey: z.string().nullable(),
  mimeType: z.string().nullable(),
  fileSize: z.number().nullable(),
  altText: z.string().nullable(),
  sortOrder: z.number(),
  isCover: z.boolean(),
  isBrochure: z.boolean(),
  isBrochureCurrent: z.boolean(),
  brochureVersion: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const generateBrochureRoute = createRoute({
  method: "post",
  path: "/{id}/brochure/generate",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "The generated + stored brochure with upload metadata",
      content: {
        "application/json": {
          schema: z.object({
            data: brochureMediaSchema,
            metadata: z.object({
              filename: z.string(),
              sizeBytes: z.number(),
              storageKey: z.string(),
              url: z.string(),
            }),
          }),
        },
      },
    },
    400: {
      description: "id route param is required",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    413: {
      description: "Generated brochure exceeds the configured size cap",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    503: {
      description: "Storage not configured",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

/**
 * Deployment-supplied options for the product brochure route. Structural only —
 * the injected functions encapsulate the deployment's storage binding and
 * (optional) PDF renderer so this package stays free of those static imports.
 */
export interface ProductBrochureRoutesOptions {
  /**
   * Resolve the storage provider to upload the generated brochure into, or
   * `null` when storage isn't configured (the route then responds `503`).
   */
  resolveStorage(c: Context): StorageProvider | null
  /**
   * Resolve an optional PDF printer for this request (e.g. a browser-rendering
   * service). When omitted, the brochure task falls back to its built-in
   * pdf-lib printer.
   */
  resolvePrinter?(c: Context): ProductBrochurePrinter | null
  /**
   * The brochure template. Defaults to {@link createDefaultProductBrochureTemplate}.
   */
  template?: ProductBrochureTemplateDefinition
  /** Storage key prefix builder. Defaults to `brochures/products/:id`. */
  keyPrefix?(productId: string): string
  /** Max generated PDF size in bytes before rejecting with 413. */
  maxSizeBytes?: number
}

/**
 * Build the product brochure route (relative path; mount at
 * `/v1/admin/products`). Storage + the optional printer are injected via
 * `options`.
 */
export function createProductBrochureRoutes(
  options: ProductBrochureRoutesOptions,
): OpenAPIHono<Env> {
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_BROCHURE_PDF_BYTES

  const app = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  app.use("*", idempotencyKey())
  app.openapi(generateBrochureRoute, async (c) => {
    const storage = options.resolveStorage(c)
    if (!storage) {
      return c.json({ error: "Storage not configured" }, 503)
    }

    const productId = c.req.valid("param").id
    if (!productId) return c.json({ error: "id route param is required" }, 400)

    const printer = options.resolvePrinter?.(c) ?? null
    const keyPrefix = options.keyPrefix?.(productId) ?? `brochures/products/${productId}`

    let generated: Awaited<ReturnType<typeof generateAndStoreProductBrochure>>
    try {
      generated = await generateAndStoreProductBrochure(c.get("db"), productId, {
        storage,
        template: options.template ?? createDefaultProductBrochureTemplate(),
        ...(printer ? { printer } : {}),
        keyPrefix,
        filename: ({ productId: generatedProductId, filename }) =>
          `brochure-${generatedProductId}-${Date.now()}-${filename}`,
        maxSizeBytes,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("Generated brochure is too large")) {
        return c.json({ error: message }, 413)
      }
      if (err instanceof ProductBrochureStorageError) {
        return c.json({ error: PRODUCT_BROCHURE_STORAGE_ERROR_MESSAGE }, 503)
      }
      throw err
    }

    await emitProductContentChanged(c.get("eventBus"), { id: productId, axis: "media" })

    return c.json(
      {
        data: generated.brochure,
        metadata: {
          filename: generated.filename,
          sizeBytes: generated.sizeBytes,
          storageKey: generated.storageKey,
          url: generated.url,
        },
      },
      200,
    )
  })
  return app
}

export const productBrochureExtension: Extension = {
  name: "brochure",
  module: "products",
}

/** Build the inventory-owned brochure generation extension. */
export function createProductBrochureApiExtension(
  options: ProductBrochureRoutesOptions,
): ApiExtension {
  return {
    extension: productBrochureExtension,
    adminRoutes: createProductBrochureRoutes(options),
  }
}

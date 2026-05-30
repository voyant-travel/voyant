import type { EventBus } from "@voyantjs/core"
import {
  createDefaultProductBrochureTemplate,
  generateAndStoreProductBrochure,
} from "@voyantjs/products"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Hono } from "hono"
import { createProductBrochurePrinter } from "../lib/brochure-printer"
import { createVideoUploadTicket } from "../lib/video-uploads"
import { tryGetCloudClient } from "../lib/voyant-cloud"
import { createMediaStorage, guessMimeType } from "./lib/storage"

const MAX_BROCHURE_PDF_BYTES = 5 * 1024 * 1024

type OperatorMediaUploadRouteEnv = {
  Bindings: CloudflareBindings
  Variables: {
    db: PostgresJsDatabase
    eventBus?: EventBus
  }
}

export function mountOperatorMediaUploadRoutes(hono: Hono<OperatorMediaUploadRouteEnv>): void {
  hono.post("/v1/admin/products/:id/brochure/generate", async (c) => {
    const storage = createMediaStorage(c.env)
    if (!storage) {
      return c.json({ error: "Storage not configured" }, 503)
    }

    const productId = c.req.param("id")
    if (!productId) return c.json({ error: "id route param is required" }, 400)

    const cloud = tryGetCloudClient(c.env)
    let generated: Awaited<ReturnType<typeof generateAndStoreProductBrochure>>
    try {
      generated = await generateAndStoreProductBrochure(c.get("db"), productId, {
        storage,
        template: createDefaultProductBrochureTemplate(),
        ...(cloud ? { printer: createProductBrochurePrinter(c.env) } : {}),
        keyPrefix: `brochures/products/${productId}`,
        filename: ({ productId: generatedProductId, filename }) =>
          `brochure-${generatedProductId}-${Date.now()}-${filename}`,
        maxSizeBytes: MAX_BROCHURE_PDF_BYTES,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("Generated brochure is too large")) {
        return c.json({ error: message }, 413)
      }
      throw err
    }

    await c.get("eventBus")?.emit("product.content.changed", {
      id: productId,
      axis: "media",
    })

    return c.json({
      data: generated.brochure,
      metadata: {
        filename: generated.filename,
        sizeBytes: generated.sizeBytes,
        storageKey: generated.storageKey,
        url: generated.url,
      },
    })
  })

  hono.post("/v1/uploads", async (c) => {
    const storage = createMediaStorage(c.env)
    if (!storage) {
      return c.json({ error: "Storage not configured" }, 503)
    }

    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) {
      return c.json({ error: "Missing file field in multipart body" }, 400)
    }

    const ext = file.name.split(".").pop() ?? "bin"
    const key = `uploads/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

    const result = await storage.upload(await file.arrayBuffer(), {
      key,
      contentType: file.type,
    })

    return c.json({
      key: result.key,
      url: result.url,
      mimeType: file.type,
      size: file.size,
    })
  })

  hono.post("/v1/uploads/video", async (c) => {
    const body = await c.req.json<{
      fileSize: number
      maxDurationSeconds: number
      name?: string | null
      requireSignedUrls?: boolean
      allowedOrigins?: string[]
      thumbnailTimestampPct?: number | null
      meta?: Record<string, string>
    }>()
    const ticket = await createVideoUploadTicket(c.env, body)
    return c.json(ticket)
  })

  hono.get("/v1/media/*", async (c) => {
    const storage = createMediaStorage(c.env)
    if (!storage) {
      return c.json({ error: "Storage not configured" }, 503)
    }

    const key = c.req.path.replace("/v1/media/", "")
    if (!key) {
      return c.json({ error: "Missing key" }, 400)
    }

    const buffer = await storage.get(key)
    if (!buffer) {
      return c.json({ error: "Not found" }, 404)
    }

    const headers = new Headers()
    headers.set("Content-Type", guessMimeType(key))
    headers.set("Cache-Control", "public, max-age=31536000, immutable")
    headers.set("Content-Length", String(buffer.byteLength))

    return new Response(buffer, { headers })
  })
}

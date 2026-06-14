import type { EventBus } from "@voyant-travel/core"
import { parseJsonBody } from "@voyant-travel/hono"
import {
  createDefaultProductBrochureTemplate,
  generateAndStoreProductBrochure,
} from "@voyant-travel/inventory/tasks"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"
import { z } from "zod"
import { createProductBrochurePrinter } from "../lib/brochure-printer"
import { createVideoUploadTicket } from "../lib/video-uploads"
import { tryGetCloudClient } from "../lib/voyant-cloud"
import { createMediaStorage, guessMimeType } from "./lib/storage"

const MAX_BROCHURE_PDF_BYTES = 5 * 1024 * 1024
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const MAX_MULTIPART_UPLOAD_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024
const MAX_VIDEO_UPLOAD_BYTES = 1024 * 1024 * 1024
const MAX_VIDEO_DURATION_SECONDS = 12 * 60 * 60

const ALLOWED_MEDIA_KEY_PREFIXES = ["uploads/", "brochures/products/"] as const
const UNSAFE_UPLOAD_EXTENSIONS = new Set(["cjs", "htm", "html", "js", "mjs", "svg", "xhtml", "xml"])
const SCRIPTABLE_MIME_TYPES = new Set([
  "application/ecmascript",
  "application/javascript",
  "application/xhtml+xml",
  "application/xml",
  "image/svg+xml",
  "text/ecmascript",
  "text/html",
  "text/javascript",
  "text/xml",
])

const videoUploadTicketBodySchema = z.object({
  fileSize: z.number().int().positive().max(MAX_VIDEO_UPLOAD_BYTES),
  maxDurationSeconds: z.number().int().positive().max(MAX_VIDEO_DURATION_SECONDS),
  name: z.string().trim().min(1).max(255).optional().nullable(),
  requireSignedUrls: z.boolean().optional(),
  allowedOrigins: z.array(z.string().trim().min(1).max(2048)).max(20).optional(),
  thumbnailTimestampPct: z.number().min(0).max(1).optional().nullable(),
  meta: z.record(z.string().max(128), z.string().max(2048)).optional(),
})

type OperatorMediaUploadRouteEnv = {
  Bindings: CloudflareBindings
  Variables: {
    db: PostgresJsDatabase
    eventBus?: EventBus
  }
}

function maybeString(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

function safeAsciiFilename(filename: string | null | undefined) {
  const normalized = maybeString(filename)
  if (!normalized) return "download"

  const safe = normalized
    .normalize("NFKD")
    .replace(/[^\w .-]+/g, "-")
    .replace(/[\r\n"\\]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160)

  return safe || "download"
}

function contentDispositionForKey(key: string) {
  return `attachment; filename="${safeAsciiFilename(key.split("/").filter(Boolean).at(-1))}"`
}

function getContentLength(c: Context) {
  const raw = c.req.header("content-length")
  if (!raw) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function normalizedMimeType(contentType: string | null | undefined) {
  const value = maybeString(contentType)
  if (!value) return null
  return value.split(";")[0]?.trim().toLowerCase() || null
}

function isScriptableMimeType(contentType: string | null | undefined) {
  const normalized = normalizedMimeType(contentType)
  return normalized ? SCRIPTABLE_MIME_TYPES.has(normalized) : false
}

function extensionFromFilename(filename: string) {
  const lastSegment = filename.split(/[\\/]/).at(-1) ?? filename
  const ext = lastSegment.includes(".") ? lastSegment.split(".").pop() : undefined
  const normalized = ext?.trim().toLowerCase()
  return normalized && /^[a-z0-9]{1,16}$/.test(normalized) ? normalized : "bin"
}

function safeUploadContentType(file: File) {
  const contentType = normalizedMimeType(file.type)
  if (!contentType || isScriptableMimeType(contentType)) {
    return "application/octet-stream"
  }
  return contentType
}

function safeServedContentType(key: string) {
  const guessed = guessMimeType(key)
  return isScriptableMimeType(guessed) ? "application/octet-stream" : guessed
}

function parseMediaKey(path: string) {
  const rawKey = path.replace(/^\/v1\/(?:admin\/)?media\//, "")
  if (!rawKey) return null

  const segments: string[] = []
  for (const rawSegment of rawKey.split("/")) {
    if (!rawSegment) return null
    let segment: string
    try {
      segment = decodeURIComponent(rawSegment)
    } catch {
      return null
    }
    if (
      !segment ||
      segment === "." ||
      segment === ".." ||
      segment.includes("/") ||
      segment.includes("\\") ||
      segment.includes("\0")
    ) {
      return null
    }
    segments.push(segment)
  }

  const key = segments.join("/")
  return ALLOWED_MEDIA_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)) ? key : null
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

  const handleUpload = async (c: Context<OperatorMediaUploadRouteEnv>) => {
    const storage = createMediaStorage(c.env)
    if (!storage) {
      return c.json({ error: "Storage not configured" }, 503)
    }

    const contentLength = getContentLength(c)
    if (contentLength !== null && contentLength > MAX_MULTIPART_UPLOAD_BYTES) {
      return c.json({ error: `Upload is too large; limit is ${MAX_UPLOAD_BYTES} bytes` }, 413)
    }

    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) {
      return c.json({ error: "Missing file field in multipart body" }, 400)
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return c.json({ error: `Upload is too large; limit is ${MAX_UPLOAD_BYTES} bytes` }, 413)
    }

    const ext = extensionFromFilename(file.name)
    if (UNSAFE_UPLOAD_EXTENSIONS.has(ext) || isScriptableMimeType(file.type)) {
      return c.json({ error: "Unsupported upload file type" }, 415)
    }

    const key = `uploads/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
    const contentType = safeUploadContentType(file)

    const result = await storage.upload(await file.arrayBuffer(), {
      key,
      contentType,
    })

    return c.json({
      key: result.key,
      url: result.url,
      mimeType: contentType,
      size: file.size,
    })
  }

  hono.post("/v1/uploads", handleUpload)
  hono.post("/v1/admin/uploads", handleUpload)

  const handleVideoUploadTicket = async (c: Context<OperatorMediaUploadRouteEnv>) => {
    const body = await parseJsonBody(c, videoUploadTicketBodySchema)
    const ticket = await createVideoUploadTicket(c.env, body)
    return c.json(ticket)
  }

  hono.post("/v1/uploads/video", handleVideoUploadTicket)
  hono.post("/v1/admin/uploads/video", handleVideoUploadTicket)

  const handleMediaServe = async (c: Context<OperatorMediaUploadRouteEnv>) => {
    const storage = createMediaStorage(c.env)
    if (!storage) {
      return c.json({ error: "Storage not configured" }, 503)
    }

    const key = parseMediaKey(c.req.path)
    if (!key) {
      return c.json({ error: "Invalid media key" }, 400)
    }

    const buffer = await storage.get(key)
    if (!buffer) {
      return c.json({ error: "Not found" }, 404)
    }

    const headers = new Headers()
    headers.set("Content-Type", safeServedContentType(key))
    headers.set("X-Content-Type-Options", "nosniff")
    headers.set("Content-Disposition", contentDispositionForKey(key))
    headers.set("Cache-Control", "public, max-age=31536000, immutable")
    headers.set("Content-Length", String(buffer.byteLength))

    return new Response(buffer, { headers })
  }

  hono.get("/v1/media/*", handleMediaServe)
  hono.get("/v1/admin/media/*", handleMediaServe)
}

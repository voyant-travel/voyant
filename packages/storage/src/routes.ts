/**
 * Media upload + serve HTTP routes, owned by `@voyant-travel/storage`.
 *
 * agent-quality: file-size exception -- the media surface (multipart upload,
 * video upload ticket, and hardened object serving) is one cohesive route family that
 * shares the same content-type safety + key-parsing helpers; splitting it would
 * scatter a single storage-backed contract.
 *
 *   POST /v1/admin/uploads         — multipart file upload → storage ticket
 *   POST /v1/admin/uploads/video   — video upload ticket (deployment signer)
 *   GET  /v1/admin/media/*         — serve stored bytes (hardened)
 *
 * These routes register ABSOLUTE admin paths, so a deployment mounts the
 * returned `Hono` at the app root rather than under a module prefix.
 *
 * The deployment supplies the storage-backed specifics via `options`:
 *   - `resolveStorage(c)` — the selected `StorageProvider` for this request
 *     (or `null` when storage isn't configured → 503),
 *   - `signVideoUploadTicket(c, input)` — turn a validated video-upload request
 *     into a provider ticket (TUS / Cloudflare Stream / …),
 *   - `guessServedMimeType(key)` — best-effort MIME guess for the serve route.
 *
 * The package never imports a deployment vendor SDK or video provider.
 */

import { OpenAPIHono } from "@hono/zod-openapi"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { Context } from "hono"
import { z } from "zod"
import { storageMediaRuntimePort } from "./runtime-port.js"
import type { StorageProvider } from "./types.js"

export { storageMediaRuntimePort } from "./runtime-port.js"

// ─────────────────────────────────────────────────────────────────
// Tuning constants (preserved byte-for-byte from the operator origin)
// ─────────────────────────────────────────────────────────────────

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

/** Validated body shape for a video upload ticket request. */
export const videoUploadTicketBodySchema = z.object({
  fileSize: z.number().int().positive().max(MAX_VIDEO_UPLOAD_BYTES),
  maxDurationSeconds: z.number().int().positive().max(MAX_VIDEO_DURATION_SECONDS),
  name: z.string().trim().min(1).max(255).optional().nullable(),
  requireSignedUrls: z.boolean().optional(),
  allowedOrigins: z.array(z.string().trim().min(1).max(2048)).max(20).optional(),
  thumbnailTimestampPct: z.number().min(0).max(1).optional().nullable(),
  meta: z.record(z.string().max(128), z.string().max(2048)).optional(),
})

export type VideoUploadTicketRequest = z.infer<typeof videoUploadTicketBodySchema>

// ─────────────────────────────────────────────────────────────────
// Injected deployment surface
// ─────────────────────────────────────────────────────────────────

/**
 * Deployment-supplied options for the media route module. Structural only —
 * the injected functions encapsulate the deployment's object storage and video
 * provider so this package stays free of those static imports.
 */
export interface MediaRoutesOptions {
  /**
   * Resolve the storage provider for this request, or `null` when storage
   * isn't configured (the upload/serve routes then respond `503`).
   */
  resolveStorage(c: Context): StorageProvider | null
  /**
   * Turn a validated video-upload request into a provider ticket. The
   * deployment owns the provider (Cloudflare Stream / any TUS host).
   */
  signVideoUploadTicket(c: Context, input: VideoUploadTicketRequest): Promise<unknown>
  /**
   * Best-effort MIME guess from a stored object key, used by the serve route.
   * Defaults to {@link guessMimeType}.
   */
  guessServedMimeType?(key: string): string
}

/** Absolute paths contributed by the storage-owned media route family. */
export const STORAGE_MEDIA_ROUTE_PATHS = [
  "/v1/admin/uploads",
  "/v1/admin/uploads/video",
  "/v1/admin/media/*",
] as const

export const STORAGE_OPENAPI_API_IDS = {
  uploads: "@voyant-travel/storage#api.admin.uploads",
  videoUploadTicket: "@voyant-travel/storage#api.admin.video-upload-ticket",
  media: "@voyant-travel/storage#api.admin.media",
} as const

/** Structural module shape kept local so storage does not depend on the server API runtime package. */
export interface MediaApiModule {
  module: { name: "media" }
  lazyRoutes: {
    paths: typeof STORAGE_MEDIA_ROUTE_PATHS
    load: () => Promise<ReturnType<typeof createMediaRoutes>>
  }
}

/**
 * Package-owned media module. Deployments inject storage and video signing;
 * inventory brochure generation composes as a separate extension.
 */
export function createMediaApiModule(options: MediaRoutesOptions): MediaApiModule {
  return {
    module: { name: "media" },
    lazyRoutes: {
      paths: STORAGE_MEDIA_ROUTE_PATHS,
      load: async () => createMediaRoutes(options),
    },
  }
}

/** Package-owned adapter from the graph port registry to the public route factory. */
export const createStorageVoyantRuntime = defineGraphRuntimeFactory(async ({ getPort }) =>
  createMediaApiModule(await getPort(storageMediaRuntimePort)),
)

// ─────────────────────────────────────────────────────────────────
// Default MIME guessing (so a deployment can omit `guessServedMimeType`)
// ─────────────────────────────────────────────────────────────────

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

/** Best-effort MIME type guess from a file key/path. Used by the serve route. */
export function guessMimeType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? ""
  return MIME_BY_EXT[ext] ?? "application/octet-stream"
}

// ─────────────────────────────────────────────────────────────────
// Pure helpers (preserved byte-for-byte from the operator origin)
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────

/**
 * Build the media upload + serve routes (ABSOLUTE paths; mount at the app
 * root). The deployment supplies the storage provider + video signer via
 * `options`.
 */
export function createMediaRoutes(options: MediaRoutesOptions) {
  const hono = new OpenAPIHono()
  const guessServedMimeType = options.guessServedMimeType ?? guessMimeType

  function safeServedContentType(key: string) {
    const guessed = guessServedMimeType(key)
    return isScriptableMimeType(guessed) ? "application/octet-stream" : guessed
  }

  const handleUpload = async (c: Context) => {
    const storage = options.resolveStorage(c)
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

  hono.post("/v1/admin/uploads", handleUpload)

  const handleVideoUploadTicket = async (c: Context) => {
    let raw: unknown
    try {
      raw = await c.req.json()
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }
    const parsed = videoUploadTicketBodySchema.safeParse(raw)
    if (!parsed.success) {
      return c.json({ error: "Invalid request", issues: parsed.error.issues }, 400)
    }
    const ticket = await options.signVideoUploadTicket(c, parsed.data)
    return c.json(ticket)
  }

  hono.post("/v1/admin/uploads/video", handleVideoUploadTicket)

  const handleMediaServe = async (c: Context) => {
    const storage = options.resolveStorage(c)
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

  hono.get("/v1/admin/media/*", handleMediaServe)

  hono.openAPIRegistry.registerPath({
    method: "post",
    path: "/v1/admin/uploads",
    summary: "Upload media",
    responses: {
      200: { description: "The stored media reference." },
      400: { description: "The multipart request is invalid." },
      413: { description: "The upload exceeds the configured limit." },
      415: { description: "The uploaded media type is not supported." },
      503: { description: "Object storage is not configured." },
    },
    "x-voyant-api-id": STORAGE_OPENAPI_API_IDS.uploads,
  })
  hono.openAPIRegistry.registerPath({
    method: "post",
    path: "/v1/admin/uploads/video",
    summary: "Create a video upload ticket",
    responses: {
      200: { description: "A provider-specific video upload ticket." },
      400: { description: "The ticket request is invalid." },
    },
    "x-voyant-api-id": STORAGE_OPENAPI_API_IDS.videoUploadTicket,
  })
  hono.openAPIRegistry.registerPath({
    method: "get",
    path: "/v1/admin/media/{key}",
    summary: "Download stored media",
    parameters: [
      {
        in: "path",
        name: "key",
        required: true,
        allowReserved: true,
        description: "Nested object key under uploads/ or brochures/products/.",
        schema: {
          type: "string",
          pattern: "^(?:uploads|brochures/products)/.+$",
        },
      },
    ],
    responses: {
      200: { description: "The stored media bytes." },
      400: { description: "The storage key is invalid." },
      404: { description: "The object does not exist." },
      503: { description: "Object storage is not configured." },
    },
    "x-voyant-api-id": STORAGE_OPENAPI_API_IDS.media,
  })

  return hono
}

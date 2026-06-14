import type { EventBus } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Hono } from "hono"
import {
  generateContractPdfForBooking,
  previewContractForBooking,
} from "./contract-document-runtime"
import { createDocumentStorage, guessMimeType } from "./lib/storage"

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

type OperatorContractDocumentRouteEnv = {
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
  if (!normalized) return "document"

  const safe = normalized
    .normalize("NFKD")
    .replace(/[^\w .-]+/g, "-")
    .replace(/[\r\n"\\]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160)

  return safe || "document"
}

function contentDispositionForKey(key: string) {
  return `attachment; filename="${safeAsciiFilename(key.split("/").filter(Boolean).at(-1))}"`
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

function safeServedContentType(key: string) {
  const guessed = guessMimeType(key)
  return isScriptableMimeType(guessed) ? "application/octet-stream" : guessed
}

function parseDocumentKey(path: string) {
  const rawKey = path.replace(/^\/v1\/admin\/documents\/files\//, "")
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

  return segments.join("/")
}

export function mountOperatorContractDocumentRoutes(
  hono: Hono<OperatorContractDocumentRouteEnv>,
): void {
  // Manual contract-PDF generation for the booking detail page's Documents tab.
  // POST /v1/admin/bookings/:bookingId/generate-contract
  hono.post("/v1/admin/bookings/:bookingId/generate-contract", async (c) => {
    const bookingId = c.req.param("bookingId")
    if (!bookingId) return c.json({ error: "bookingId route param is required" }, 400)

    const body = await c.req
      .json<{ force?: boolean; preview?: boolean }>()
      .catch(() => ({}) as { force?: boolean; preview?: boolean })
    try {
      if (body.preview === true) {
        const preview = await previewContractForBooking(c.env, c.get("db"), bookingId)
        if (!preview) {
          return c.json({ error: "Contract template not found" }, 404)
        }
        return c.json({ data: preview })
      }

      const result = await generateContractPdfForBooking(
        c.env,
        c.get("db"),
        c.get("eventBus"),
        bookingId,
        { force: body.force === true },
      )
      if (!result) {
        return c.json(
          { error: "Contract document storage not configured (missing DOCUMENTS_BUCKET)" },
          503,
        )
      }
      return c.json({ data: result })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 502)
    }
  })

  // GET /v1/admin/documents/files/* — admin-only stream of private
  // documents bytes from the DOCUMENTS_BUCKET. Used as the fallback
  // download target for environments where the R2 binding isn't backed by a
  // real S3 SigV4 signer. Auth is the standard staff guard inherited from
  // `/v1/admin/*` middleware in createApp.
  hono.get("/v1/admin/documents/files/*", async (c) => {
    const storage = createDocumentStorage(c.env)
    if (!storage) {
      return c.json({ error: "Storage not configured" }, 503)
    }

    const key = parseDocumentKey(c.req.path)
    if (!key) return c.json({ error: "Invalid document key" }, 400)

    const buffer = await storage.get(key)
    if (!buffer) return c.json({ error: "Not found" }, 404)

    const headers = new Headers()
    headers.set("Content-Type", safeServedContentType(key))
    headers.set("X-Content-Type-Options", "nosniff")
    headers.set("Cache-Control", "private, no-store")
    headers.set("Content-Length", String(buffer.byteLength))
    headers.set("Content-Disposition", contentDispositionForKey(key))

    return new Response(buffer, { headers })
  })
}

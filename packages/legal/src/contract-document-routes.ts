/**
 * Contract-document HTTP routes, owned by the legal module.
 *
 *   POST   /v1/admin/bookings/:bookingId/generate-contract
 *   GET    /v1/admin/documents/files/*
 *
 * The first route generates (or previews) a booking's contract PDF; the second
 * streams private document bytes from the deployment's document storage — used
 * as the authenticated download fallback for environments where the R2 binding
 * isn't backed by a real S3 SigV4 signer.
 *
 * These shapes (validation, status codes, headers, the scriptable-mime safety,
 * the path-traversal-safe key parser) are framework logic and live here. The
 * deployment supplies the contract generator/preview, the document storage
 * resolver, and the MIME guesser via `ContractDocumentRoutesOptions`.
 *
 * The routes are mounted at absolute paths (the family spans multiple prefixes),
 * so a deployment composes them via `lazyRoutes` using
 * `CONTRACT_DOCUMENT_ROUTE_PATHS`.
 */
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { HonoModule } from "@voyant-travel/hono/module"
import type { Context } from "hono"

/** Minimal structural view of the deployment's document storage backend. */
export interface ContractDocumentStorageLike {
  get(key: string): Promise<ArrayBuffer | null>
}

/**
 * Deployment-supplied dependencies for the contract-document routes. Generic /
 * structural types keep the legal package free of operator types and
 * CloudflareBindings — the deployment casts `c.env` / `c.get("db")` to its own
 * concrete types inside these callbacks.
 */
export interface ContractDocumentRoutesOptions {
  /**
   * Generate (and persist) the booking's contract PDF. Returns `null` when
   * document storage isn't configured (→ 503). The deployment reads its
   * concrete db / event bus from `c` and casts as needed.
   */
  generateContract(
    env: unknown,
    db: unknown,
    eventBus: unknown,
    bookingId: string,
    options: { force?: boolean },
  ): Promise<{ contractId: string; attachmentId: string } | null>
  /**
   * Render the contract preview HTML for a booking. Returns `null` when the
   * contract template can't be found (→ 404).
   */
  previewContract(
    env: unknown,
    db: unknown,
    bookingId: string,
  ): Promise<{ html: string; templateName: string; templateLanguage: string } | null>
  /**
   * Resolve the private document storage backend from the request env. Returns
   * `null` when storage isn't configured (→ 503).
   */
  resolveStorage(env: unknown): ContractDocumentStorageLike | null
  /** Best-effort MIME-type guess from a document key/path. */
  guessMimeType(key: string): string
}

/** Absolute path matchers for the deployment's `lazyRoutes.paths`. */
export const CONTRACT_DOCUMENT_ROUTE_PATHS = [
  "/v1/admin/bookings/:bookingId/generate-contract",
  "/v1/admin/documents/files/*",
] as const

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

function safeServedContentType(guessMimeType: (key: string) => string, key: string) {
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

// --- OpenAPI route definitions (voyant#2114) --------------------------------
//
// The booking generate-contract leg is a documented JSON operation surfaced via
// `.openapi()`. The body is optional (`force`/`preview`), so it declares no
// forcing OpenAPI request body and parses in-handler. The
// `/v1/admin/documents/files/*` byte-stream is an admin-only raw download served
// via `new Response`; it stays a plain `.get(...)` wildcard on the same
// `OpenAPIHono` (catch-all path keys aren't expressible as a published OpenAPI
// JSON operation), so it keeps working at runtime without polluting the spec.

const errorResponseSchema = z.object({ error: z.string() })

const generateContractDocumentEnvelopeSchema = z.object({
  data: z.record(z.string(), z.unknown()),
})

const generateBookingContractRoute = createRoute({
  method: "post",
  path: "/v1/admin/bookings/{bookingId}/generate-contract",
  request: { params: z.object({ bookingId: z.string() }) },
  responses: {
    200: {
      description: "The generated contract document reference, or a rendered preview",
      content: { "application/json": { schema: generateContractDocumentEnvelopeSchema } },
    },
    400: {
      description: "bookingId route param is required",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Contract template not found (preview mode)",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    502: {
      description: "Contract document generation failed",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    503: {
      description: "Contract document storage not configured (missing DOCUMENTS_BUCKET)",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

/**
 * Build the contract-document routes (absolute paths). A deployment composes
 * these via `lazyRoutes` and supplies the generator/preview, storage resolver,
 * and MIME guesser.
 */
export function createContractDocumentRoutes(options: ContractDocumentRoutesOptions) {
  const { generateContract, previewContract, resolveStorage, guessMimeType } = options

  const hono = new OpenAPIHono({ defaultHook: openApiValidationHook })
    // Manual contract-PDF generation for the booking detail page's Documents tab.
    .openapi(generateBookingContractRoute, async (c) => {
      const bookingId = c.req.valid("param").bookingId
      if (!bookingId) return c.json({ error: "bookingId route param is required" }, 400)

      const body = await c.req
        .json<{ force?: boolean; preview?: boolean }>()
        .catch(() => ({}) as { force?: boolean; preview?: boolean })
      try {
        if (body.preview === true) {
          const preview = await previewContract(c.env, c.get("db"), bookingId)
          if (!preview) {
            return c.json({ error: "Contract template not found" }, 404)
          }
          return c.json({ data: preview }, 200)
        }

        const result = await generateContract(c.env, c.get("db"), c.get("eventBus"), bookingId, {
          force: body.force === true,
        })
        if (!result) {
          return c.json(
            { error: "Contract document storage not configured (missing DOCUMENTS_BUCKET)" },
            503,
          )
        }
        return c.json({ data: result }, 200)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return c.json({ error: message }, 502)
      }
    })

  // GET /v1/admin/documents/files/* — admin-only stream of private
  // documents bytes from the document storage. Used as the fallback
  // download target for environments where the R2 binding isn't backed by a
  // real S3 SigV4 signer. Auth is the standard staff guard inherited from
  // `/v1/admin/*` middleware in createApp. Served via `new Response`; a
  // catch-all path isn't a publishable OpenAPI operation, so it stays a plain
  // wildcard handler on this OpenAPIHono instance.
  hono.get("/v1/admin/documents/files/*", async (c: Context) => {
    const storage = resolveStorage(c.env)
    if (!storage) {
      return c.json({ error: "Storage not configured" }, 503)
    }

    const key = parseDocumentKey(c.req.path)
    if (!key) return c.json({ error: "Invalid document key" }, 400)

    const buffer = await storage.get(key)
    if (!buffer) return c.json({ error: "Not found" }, 404)

    const headers = new Headers()
    headers.set("Content-Type", safeServedContentType(guessMimeType, key))
    headers.set("X-Content-Type-Options", "nosniff")
    headers.set("Cache-Control", "private, no-store")
    headers.set("Content-Length", String(buffer.byteLength))
    headers.set("Content-Disposition", contentDispositionForKey(key))

    return new Response(buffer, { headers })
  })

  return hono
}

/** Package-owned module descriptor; deployments inject document generation and storage. */
export function createContractDocumentHonoModule(
  options: ContractDocumentRoutesOptions,
): HonoModule {
  return {
    module: { name: "contract-document" },
    lazyRoutes: {
      paths: CONTRACT_DOCUMENT_ROUTE_PATHS,
      load: async () => createContractDocumentRoutes(options),
    },
  }
}

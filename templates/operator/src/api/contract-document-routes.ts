import type { EventBus } from "@voyantjs/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Hono } from "hono"
import {
  generateContractPdfForBooking,
  previewContractForBooking,
} from "./contract-document-runtime"
import { createDocumentStorage, guessMimeType } from "./lib/storage"

type OperatorContractDocumentRouteEnv = {
  Bindings: CloudflareBindings
  Variables: {
    db: PostgresJsDatabase
    eventBus?: EventBus
  }
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

    const rawKey = c.req.path.replace("/v1/admin/documents/files/", "")
    const key = rawKey
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/")
    if (!key) return c.json({ error: "Missing key" }, 400)

    const buffer = await storage.get(key)
    if (!buffer) return c.json({ error: "Not found" }, 404)

    const headers = new Headers()
    headers.set("Content-Type", guessMimeType(key))
    headers.set("Cache-Control", "private, no-store")
    headers.set("Content-Length", String(buffer.byteLength))
    headers.set("Content-Disposition", `inline; filename="${key.split("/").pop() ?? "document"}"`)

    return new Response(buffer, { headers })
  })
}

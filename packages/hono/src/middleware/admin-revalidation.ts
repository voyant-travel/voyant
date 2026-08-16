/**
 * Conditional-request support for the staff surface (voyant#4754).
 *
 * Admin reads were leaving cache policy unstated. Edge caching is already
 * bypassed for cookie-bearing requests, so nothing shared was at risk — but a
 * response with no directives is also not reusable by the *browser*, so every
 * repeat navigation and every reload re-downloaded a body the client already
 * had, byte for byte.
 *
 * The directive is `private, no-cache`, not `private, max-age=N`. `no-cache`
 * means "store it, but ask before reusing it": the browser keeps the payload
 * and revalidates with `If-None-Match`, so a repeat read costs one round trip
 * and a 304 with no body instead of a full re-transfer. `max-age` would skip
 * the round trip too, but at the price of a window in which a staff member
 * sees a record they have already changed — which is why the few admin routes
 * that opt into one (`private, max-age=30` on dashboard aggregates) do it
 * deliberately, per route. A route that sets its own `Cache-Control` is left
 * alone here, so that opt-in keeps working.
 *
 * Only JSON bodies are handled. Hashing requires buffering, and the staff
 * surface also streams documents and file downloads; those keep their
 * streaming behaviour and stay unstamped.
 */
import type { MiddlewareHandler } from "hono"

import { sha256Hex } from "../auth/crypto.js"
import type { VoyantBindings } from "../types.js"

/** Store the body, but never reuse it without asking the origin first. */
export const ADMIN_REVALIDATE_CACHE_CONTROL = "private, no-cache"

/**
 * A member's admin response is scoped by their session, so a stored entry may
 * only be reused for the same credential.
 */
const ADMIN_VARY_HEADERS = ["Cookie", "Authorization"] as const

export interface AdminRevalidationOptions {
  /**
   * Response media types eligible for an ETag. Matched against the media type
   * of `Content-Type`, ignoring parameters. Defaults to JSON only.
   */
  contentTypes?: readonly string[]
  /**
   * Bodies larger than this are passed through unstamped rather than hashed.
   * Default 4 MiB.
   */
  maxBodyBytes?: number
}

const DEFAULT_CONTENT_TYPES = ["application/json"] as const
const DEFAULT_MAX_BODY_BYTES = 4 * 1024 * 1024

function mediaType(contentType: string | null): string {
  return (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? ""
}

/**
 * `If-None-Match` is a list, and `W/"x"` and `"x"` are the same entity under
 * the weak comparison a GET revalidation uses. Compare on the opaque tag.
 */
function opaqueTag(value: string): string {
  const trimmed = value.trim()
  const withoutWeak = trimmed.startsWith("W/") ? trimmed.slice(2) : trimmed
  return withoutWeak.replace(/^"|"$/g, "")
}

function matchesIfNoneMatch(header: string, etag: string): boolean {
  if (header.trim() === "*") return true
  const wanted = opaqueTag(etag)
  return header.split(",").some((candidate) => opaqueTag(candidate) === wanted)
}

function appendVary(headers: Headers): void {
  const existing = headers.get("Vary")
  if (existing?.trim() === "*") return
  const present = new Set(
    (existing ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  )
  const missing = ADMIN_VARY_HEADERS.filter((value) => !present.has(value.toLowerCase()))
  if (missing.length === 0) return
  headers.set("Vary", existing ? `${existing}, ${missing.join(", ")}` : missing.join(", "))
}

/**
 * Stamp safe, successful JSON reads with `Cache-Control` + `ETag`, and answer
 * a matching `If-None-Match` with 304.
 *
 * Mount it on the staff surface (`/v1/admin/*`). It wraps the handler, so the
 * origin still does the work on a revalidation — what a 304 saves is the
 * payload, not the query. Skipping the round trip as well is a per-route
 * `max-age` decision, deliberately not made here.
 */
export function adminResponseRevalidation<TBindings extends VoyantBindings = VoyantBindings>(
  options: AdminRevalidationOptions = {},
): MiddlewareHandler<{ Bindings: TBindings }> {
  const contentTypes = new Set<string>(options.contentTypes ?? DEFAULT_CONTENT_TYPES)
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES

  return async (c, next) => {
    const method = c.req.method
    if (method !== "GET" && method !== "HEAD") return next()

    await next()

    const response = c.res
    if (response.status !== 200) return
    // A route that stated its own policy owns it — including the deliberate
    // `private, max-age=30` aggregates and anything marked `no-store`.
    if (response.headers.has("Cache-Control")) return
    if (!contentTypes.has(mediaType(response.headers.get("Content-Type")))) return
    if (!response.body) return

    // Hash a clone: draining `c.res` itself would leave the runtime nothing to
    // send, and reassigning `c.res` copies the previous headers back over the
    // new response (Hono's `set res`), which would undo the stamp below.
    const body = await response.clone().arrayBuffer()
    if (body.byteLength > maxBodyBytes) return

    const digest = await sha256Hex(new Uint8Array(body))
    const etag = `W/"${digest.slice(0, 32)}"`
    response.headers.set("ETag", etag)
    response.headers.set("Cache-Control", ADMIN_REVALIDATE_CACHE_CONTROL)
    appendVary(response.headers)

    const ifNoneMatch = c.req.header("if-none-match")
    if (!ifNoneMatch || !matchesIfNoneMatch(ifNoneMatch, etag)) return

    // RFC 9110 §15.4.5: a 304 carries no body, and keeps the validators and
    // cache directives so the stored entry is refreshed. Hono's `set res`
    // copies these headers onto the replacement (skipping `Content-Type`), so
    // drop the now-wrong length before handing over.
    response.headers.delete("Content-Length")
    c.res = new Response(null, { status: 304 })
  }
}

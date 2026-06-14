import { infraIdempotencyKeysTable } from "@voyant-travel/db/schema/infra"
import { and, eq, lt } from "drizzle-orm"
import type { MiddlewareHandler } from "hono"
import {
  type DbFactory,
  resolveDbFactoryResult,
  type VoyantBindings,
  type VoyantDb,
  type VoyantVariables,
} from "../types.js"
import { RequestValidationError } from "../validation.js"
import { DEFAULT_REQUEST_BODY_LIMIT_BYTES } from "./body-size.js"
import { clientIpKey } from "./rate-limit.js"

/**
 * Twenty-four hours, in milliseconds. Default TTL for stored idempotency
 * keys. Tunable per middleware instance.
 */
export const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000

const HEADER_NAME = "Idempotency-Key"

/**
 * Hashes a UTF-8 string with SHA-256 and returns the hex digest. Uses Web
 * Crypto so the middleware works in Cloudflare Workers and Node.
 */
async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", data)
  const bytes = new Uint8Array(digest)
  let out = ""
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, "0")
  }
  return out
}

export interface IdempotencyKeyOptions {
  /**
   * Namespacing label so unrelated endpoints can safely accept overlapping
   * client keys. Defaults to the request method + pathname when omitted.
   */
  scope?: string
  /**
   * How long stored responses are replayable. Defaults to
   * {@link DEFAULT_IDEMPOTENCY_TTL_MS}.
   */
  ttlMs?: number
  /**
   * Whether the header is required. When `true`, requests without the header
   * are rejected with 400. Defaults to `false` so existing clients keep
   * working through a deprecation window.
   */
  required?: boolean
  /**
   * Query parameters that affect the response contract and should be included
   * in the idempotency fingerprint alongside the request body. Reusing the
   * same key with different fingerprinted query values returns 409 instead of
   * replaying a response captured under different request semantics.
   */
  fingerprintSearchParams?: readonly string[]
  /**
   * Optional callback that, given the response body that's about to be
   * stored, returns a `referenceId` (typically the booking id). Used for
   * operational queries to correlate replays with the underlying entity.
   */
  extractReferenceId?: (body: unknown) => string | null | undefined
  /**
   * Whether successful JSON responses are replayable. Disable for
   * endpoints whose response carries session-bound bearer secrets.
   */
  replayResponses?: boolean
  /**
   * Include the caller/session/IP in the `(scope, key)` namespace.
   * Enabled by default so client-chosen keys cannot replay another
   * caller's response on anonymous or shared public surfaces.
   */
  scopeWithCaller?: boolean
  /** Maximum request body bytes the middleware may buffer. Defaults to 10 MiB. */
  maxBodyBytes?: number
}

interface ContextWithIdempotency {
  idempotencyKey?: string
  idempotencyReplayed?: boolean
}

declare module "hono" {
  interface ContextVariableMap extends ContextWithIdempotency {}
}

/**
 * Idempotency-Key middleware.
 *
 * On request:
 * - reads the `Idempotency-Key` header
 * - if absent and `required` is false, passes through
 * - if absent and `required` is true, returns 400
 * - looks up `(scope, key)` in `idempotency_keys`:
 *   - hit + same body hash → returns the stored response (replay)
 *   - hit + different body hash → returns 409 (conflict)
 *   - miss → runs the handler, then stores the response on the way out
 *
 * The handler's response body is captured by cloning the response. The
 * `Idempotency-Key` and a `Idempotency-Replayed: true` header are echoed
 * on replay so callers can detect replays in client-side logging.
 *
 * The middleware reads the `db` instance off the request context (set by
 * the `db` middleware that ships with `createApp`) — caller is responsible
 * for ordering this middleware after `db`.
 */
export function idempotencyKey<
  TBindings extends object = VoyantBindings,
  TVariables extends { db: VoyantDb } = VoyantVariables,
>(
  options: IdempotencyKeyOptions = {},
): MiddlewareHandler<{
  Bindings: TBindings
  Variables: TVariables
}> {
  const ttlMs = options.ttlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS

  return async (c, next) => {
    if (c.req.method === "OPTIONS") return next()

    const headerKey = c.req.header(HEADER_NAME) ?? c.req.header(HEADER_NAME.toLowerCase())
    if (!headerKey) {
      if (options.required) {
        return c.json({ error: `${HEADER_NAME} header is required for this endpoint` }, 400)
      }
      return next()
    }

    if (headerKey.length > 255) {
      return c.json({ error: `${HEADER_NAME} must be 255 characters or fewer` }, 400)
    }

    const requestUrl = new URL(c.req.url)
    const baseScope = options.scope ?? `${c.req.method} ${requestUrl.pathname}`
    const scope = options.scopeWithCaller === false ? baseScope : buildCallerScopedKey(c, baseScope)
    const rawBody = await readBoundedBody(
      c,
      options.maxBodyBytes ?? DEFAULT_REQUEST_BODY_LIMIT_BYTES,
    )
    const bodyHash = await sha256Hex(
      buildFingerprintInput(rawBody, requestUrl, options.fingerprintSearchParams),
    )
    // The `db` middleware always unwraps a `DisposableDb` to a plain
    // `VoyantDb` before storing on context, so this cast is safe.
    const db = c.get("db") as VoyantDb | undefined
    if (!db) {
      throw new Error(
        "idempotencyKey middleware requires `db` on the request context. Mount `db()` (or `createApp`) before this middleware.",
      )
    }

    // Look up an existing record. If the (scope, key) was used recently we
    // either replay or 409.
    const [existing] = await db
      .select()
      .from(infraIdempotencyKeysTable)
      .where(
        and(
          eq(infraIdempotencyKeysTable.scope, scope),
          eq(infraIdempotencyKeysTable.key, headerKey),
        ),
      )
      .limit(1)

    if (existing) {
      if (existing.expiresAt < new Date()) {
        // The row is past its TTL — clean it up and proceed as if missed.
        await db
          .delete(infraIdempotencyKeysTable)
          .where(eq(infraIdempotencyKeysTable.id, existing.id))
      } else if (existing.bodyHash !== bodyHash) {
        return c.json(
          {
            error: `${HEADER_NAME} ${headerKey} was previously used with a different request body`,
          },
          409,
        )
      } else {
        c.set("idempotencyKey", headerKey)
        c.set("idempotencyReplayed", true)
        const replayed = c.json(
          existing.responseBody as Record<string, unknown>,
          existing.responseStatus as 200,
        )
        replayed.headers.set("Idempotency-Replayed", "true")
        replayed.headers.set("Idempotency-Key", headerKey)
        return replayed
      }
    }

    // Re-attach the body so downstream handlers can re-parse it. Hono's
    // `c.req.text()` consumed the original; rebuild a Request whose body
    // matches what we hashed.
    c.req.raw = new Request(c.req.raw, { body: rawBody })

    c.set("idempotencyKey", headerKey)
    c.set("idempotencyReplayed", false)

    await next()

    // Capture the response without consuming the original.
    const response = c.res
    if (!response) return

    const cloned = response.clone()
    let parsedBody: unknown = null
    try {
      const text = await cloned.text()
      parsedBody = text.length > 0 ? JSON.parse(text) : null
    } catch {
      // Non-JSON responses are not stored — idempotency replay only works
      // for JSON endpoints. Pass through silently.
      return
    }

    // Only persist successful, replayable responses (2xx). 4xx/5xx leave
    // the slot open so the client can retry with a corrected body.
    if (response.status < 200 || response.status >= 300) return
    if (options.replayResponses === false) return

    const referenceId =
      options.extractReferenceId?.(parsedBody) ??
      pickStringField(parsedBody, ["bookingId", "id"]) ??
      null

    try {
      await db
        .insert(infraIdempotencyKeysTable)
        .values({
          scope,
          key: headerKey,
          bodyHash,
          responseStatus: response.status,
          responseBody: parsedBody as never,
          referenceId,
          expiresAt: new Date(Date.now() + ttlMs),
        })
        .onConflictDoNothing({
          target: [infraIdempotencyKeysTable.scope, infraIdempotencyKeysTable.key],
        })

      // Echo the header so callers can confirm idempotent storage.
      c.res = new Response(c.res.body, {
        status: c.res.status,
        statusText: c.res.statusText,
        headers: new Headers(c.res.headers),
      })
      c.res.headers.set("Idempotency-Key", headerKey)
    } catch {
      // Best-effort storage. If the write fails we still return the
      // response — duplicate-detection just degrades to "no protection
      // for this request." Logging is the deployment's responsibility.
    }
  }
}

async function readBoundedBody(
  c: { req: { text(): Promise<string>; header(name: string): string | undefined } },
  maxBytes: number,
): Promise<string> {
  const contentLength = c.req.header("content-length")
  if (contentLength) {
    const size = Number(contentLength)
    if (Number.isFinite(size) && size > maxBytes) {
      throw new RequestValidationError("Request body too large", { maxBytes })
    }
  }
  const body = await c.req.text()
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    throw new RequestValidationError("Request body too large", { maxBytes })
  }
  return body
}

function buildCallerScopedKey(
  c: {
    get(key: string): unknown
    req: { header(name: string): string | undefined }
  },
  baseScope: string,
): string {
  const stableCaller =
    pickContextString(c, "apiKeyId") ??
    pickContextString(c, "apiTokenId") ??
    pickContextString(c, "sessionId") ??
    pickContextString(c, "userId")

  if (stableCaller) return `${baseScope}:caller:${stableCaller}`
  return `${baseScope}:ip:${clientIpKey(c)}`
}

function pickContextString(c: { get(key: string): unknown }, key: string): string | null {
  const value = c.get(key)
  return typeof value === "string" && value.length > 0 ? value : null
}

function buildFingerprintInput(
  rawBody: string,
  url: URL,
  searchParamKeys: readonly string[] | undefined,
): string {
  if (!searchParamKeys?.length) return rawBody

  const queryFingerprint = searchParamKeys.map((key) => [key, url.searchParams.getAll(key).sort()])

  return JSON.stringify({
    body: rawBody,
    query: queryFingerprint,
  })
}

function pickStringField(body: unknown, keys: string[]): string | null {
  if (!body || typeof body !== "object") return null
  const obj = body as Record<string, unknown>
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === "string" && value.length > 0) return value
    // Common shape: `{ data: { id: ... } }`
    if (key === "id" && obj.data && typeof obj.data === "object") {
      const nested = (obj.data as Record<string, unknown>).id
      if (typeof nested === "string" && nested.length > 0) return nested
    }
  }
  return null
}

/**
 * Sweep expired idempotency rows. Call from a daily cron.
 *
 * If `dbFactory` returns a `DisposableDb` (e.g. a per-call Neon
 * WebSocket Pool), the sweep awaits `dispose()` before returning so
 * the connection closes cleanly inside the cron handler.
 */
export async function purgeExpiredIdempotencyKeys<TBindings extends VoyantBindings>(
  dbFactory: DbFactory<TBindings>,
  env: TBindings,
): Promise<{ removed: number }> {
  const { db, dispose } = resolveDbFactoryResult(dbFactory(env))
  try {
    const rows = await db
      .delete(infraIdempotencyKeysTable)
      .where(lt(infraIdempotencyKeysTable.expiresAt, new Date()))
      .returning()
    return { removed: rows.length }
  } finally {
    if (dispose) await dispose()
  }
}

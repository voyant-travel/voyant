import type { KVStore } from "@voyantjs/utils/cache"
import type { MiddlewareHandler } from "hono"

import { tryGetExecutionCtx } from "../lib/execution-ctx.js"
import type { VoyantBindings } from "../types.js"

/**
 * Options for {@link publicResponseCache}.
 */
export interface PublicCacheOptions {
  /**
   * Path prefixes eligible for caching. Defaults to the public API
   * surface only — admin and legacy surfaces are never cached.
   */
  pathPrefixes?: string[]
  /**
   * Responses larger than this (in bytes, after text decoding) are not
   * stored in the KV fallback. Protects isolate memory and KV value
   * limits. Default 2 MiB. The Cache API path streams and is not
   * subject to this guard.
   */
  maxKvBodyBytes?: number
}

const DEFAULT_PREFIXES = ["/v1/public/"]
const DEFAULT_MAX_KV_BODY_BYTES = 2 * 1024 * 1024
const KV_KEY_PREFIX = "respcache:v1:"
/** Cloudflare KV rejects expirationTtl below 60 seconds. */
const KV_MIN_TTL_SECONDS = 60

/**
 * Headers never persisted into the shared cache: per-request identifiers
 * and CORS grants are recomputed for every requester (the cors middleware
 * runs upstream and decorates cache hits like any other response).
 */
function isUncacheableHeader(name: string): boolean {
  const lower = name.toLowerCase()
  return lower === "set-cookie" || lower === "x-request-id" || lower.startsWith("access-control-")
}

interface CacheControlDirectives {
  isPublic: boolean
  sMaxage: number | null
}

function parseCacheControl(value: string | null): CacheControlDirectives {
  if (!value) return { isPublic: false, sMaxage: null }
  let isPublic = false
  let sMaxage: number | null = null
  for (const part of value.split(",")) {
    const directive = part.trim().toLowerCase()
    if (directive === "public") isPublic = true
    else if (directive === "private" || directive === "no-store") {
      return { isPublic: false, sMaxage: null }
    } else if (directive.startsWith("s-maxage=")) {
      const parsed = Number.parseInt(directive.slice("s-maxage=".length), 10)
      if (Number.isFinite(parsed) && parsed > 0) sMaxage = parsed
    }
  }
  return { isPublic, sMaxage }
}

// ---- Cache API backend (self-hosted / non-namespaced Workers) ----

type CacheApiLike = {
  match(key: string): Promise<Response | undefined>
  put(key: string, response: Response): Promise<void>
}

/**
 * `caches.default` is available on regular Cloudflare Workers but
 * DISABLED inside Workers-for-Platforms namespaced scripts (access or
 * use throws). Probe once, and demote to "unavailable" on any runtime
 * failure so namespaced deployments settle on the KV fallback after a
 * single failed attempt.
 */
let cacheApiState: "unknown" | "available" | "unavailable" = "unknown"

function getCacheApi(): CacheApiLike | undefined {
  if (cacheApiState === "unavailable") return undefined
  try {
    const candidate = (globalThis as { caches?: { default?: unknown } }).caches?.default as
      | CacheApiLike
      | undefined
    if (candidate && typeof candidate.match === "function") {
      cacheApiState = "available"
      return candidate
    }
  } catch {
    // fall through to unavailable
  }
  cacheApiState = "unavailable"
  return undefined
}

function markCacheApiUnavailable(): void {
  cacheApiState = "unavailable"
}

/** Test hook — resets the memoized Cache API probe state. */
export function resetPublicCacheStateForTests(): void {
  cacheApiState = "unknown"
}

function sanitizedResponseCopy(res: Response): Response {
  const headers = new Headers()
  res.headers.forEach((value, name) => {
    if (!isUncacheableHeader(name)) headers.set(name, value)
  })
  headers.set("x-voyant-cache", "hit")
  return new Response(res.body, { status: res.status, headers })
}

// ---- KV backend (Voyant Cloud namespaced workers) ----

interface KvCachedResponse {
  status: number
  headers: Array<[string, string]>
  body: string
}

function kvKeyFor(url: string): string {
  return `${KV_KEY_PREFIX}${url}`
}

async function kvMatch(kv: KVStore, url: string): Promise<Response | undefined> {
  try {
    const entry = await kv.get<KvCachedResponse>(kvKeyFor(url), { type: "json" })
    if (!entry || typeof entry.body !== "string") return undefined
    const headers = new Headers(entry.headers)
    headers.set("x-voyant-cache", "hit")
    return new Response(entry.body, { status: entry.status, headers })
  } catch {
    return undefined
  }
}

async function kvStore(
  kv: KVStore,
  url: string,
  res: Response,
  ttlSeconds: number,
  maxBodyBytes: number,
): Promise<void> {
  try {
    const body = await res.text()
    if (body.length > maxBodyBytes) return
    const headers: Array<[string, string]> = []
    res.headers.forEach((value, name) => {
      if (!isUncacheableHeader(name)) headers.push([name, value])
    })
    const entry: KvCachedResponse = { status: res.status, headers, body }
    await kv.put(kvKeyFor(url), JSON.stringify(entry), {
      expirationTtl: Math.max(KV_MIN_TTL_SECONDS, ttlSeconds),
    })
  } catch {
    // cache writes are best-effort — never surface to the request
  }
}

/**
 * Shared response cache for the public API surface.
 *
 * Fail-closed by design: a response is only ever cached when the route
 * explicitly marked it shareable — `Cache-Control` containing `public`
 * AND a positive `s-maxage` — and it carries no `Set-Cookie`. Routes
 * emit `private`/`no-store` (or nothing) to opt out, so personalized
 * endpoints under `/v1/public/*` (customer portal, verification) are
 * never cached by accident.
 *
 * Cache hits are served before auth, the DB middleware, and the runtime
 * bootstrap — a hit costs no Postgres connection, no session lookup,
 * and no module-graph instantiation, which is the entire point under
 * storefront load (#1686).
 *
 * Backend selection: Cache API (`caches.default`) where the runtime
 * provides it; otherwise the `env.CACHE` KV binding when present;
 * otherwise the middleware is a transparent no-op.
 */
export function publicResponseCache<TBindings extends VoyantBindings>(
  options: PublicCacheOptions = {},
): MiddlewareHandler<{ Bindings: TBindings }> {
  const prefixes = options.pathPrefixes ?? DEFAULT_PREFIXES
  const maxKvBodyBytes = options.maxKvBodyBytes ?? DEFAULT_MAX_KV_BODY_BYTES

  return async (c, next) => {
    if (c.req.method !== "GET") return next()
    const path = c.req.path
    if (!prefixes.some((prefix) => path.startsWith(prefix))) return next()
    // Standard escape hatch: a requester (or a debugging operator) can
    // force revalidation with `Cache-Control: no-cache`.
    const requestDirective = c.req.header("cache-control")?.toLowerCase() ?? ""
    const bypass = requestDirective.includes("no-cache") || requestDirective.includes("no-store")

    const url = c.req.url
    const cacheApi = getCacheApi()
    const kv = !cacheApi ? c.env.CACHE : undefined

    if (!bypass) {
      if (cacheApi) {
        try {
          const hit = await cacheApi.match(url)
          if (hit) return sanitizedResponseCopy(hit)
        } catch {
          markCacheApiUnavailable()
        }
      } else if (kv) {
        const hit = await kvMatch(kv, url)
        if (hit) return hit
      }
    }

    await next()

    const res = c.res
    if (!res || res.status !== 200) return
    if (res.headers.has("set-cookie")) return
    const { isPublic, sMaxage } = parseCacheControl(res.headers.get("cache-control"))
    if (!isPublic || !sMaxage) return

    const backendCacheApi = getCacheApi()
    const backendKv = !backendCacheApi ? c.env.CACHE : undefined
    if (!backendCacheApi && !backendKv) return

    const copy = res.clone()
    const store = (async () => {
      if (backendCacheApi) {
        try {
          const headers = new Headers()
          copy.headers.forEach((value, name) => {
            if (!isUncacheableHeader(name)) headers.set(name, value)
          })
          await backendCacheApi.put(url, new Response(copy.body, { status: copy.status, headers }))
          return
        } catch {
          markCacheApiUnavailable()
        }
      }
      const fallbackKv = backendKv ?? c.env.CACHE
      if (fallbackKv) {
        await kvStore(fallbackKv, url, copy, sMaxage, maxKvBodyBytes)
      }
    })()

    const executionCtx = tryGetExecutionCtx(c)
    if (executionCtx) {
      executionCtx.waitUntil(store)
    } else {
      await store
    }
  }
}

/**
 * Install a `caches.default`-compatible in-process LRU on `globalThis`. The
 * public-cache middleware probes `globalThis.caches?.default` once and uses any
 * object exposing `{ match, put }`; a resident Node process can hold a real
 * response cache, so this shim keeps the Workers cache path working unchanged
 * (instead of forcing every deployment onto the KV fallback).
 *
 * Freshness honors `s-maxage` (preferred) then `max-age` from the stored
 * response's `Cache-Control`; entries with neither are not cached.
 */

/** The subset of the Workers Cache API the public-cache middleware calls. */
export interface CacheApiLike {
  match(request: Request | string): Promise<Response | undefined>
  put(request: Request | string, response: Response): Promise<void>
}

export interface InstallCachesShimOptions {
  /** Maximum number of resident entries before LRU eviction. */
  maxEntries: number
  /** Optional cap on total buffered body bytes. Oversized entries are skipped. */
  maxBytes?: number
}

interface CacheEntry {
  status: number
  headers: Array<[string, string]>
  body: Uint8Array
  expiresAt: number
}

function keyFor(request: Request | string): string {
  return typeof request === "string" ? request : request.url
}

function freshnessSeconds(response: Response): number | undefined {
  const cacheControl = response.headers.get("cache-control")
  if (!cacheControl) return undefined
  const sMaxage = /s-maxage=(\d+)/.exec(cacheControl)
  if (sMaxage?.[1]) return Number.parseInt(sMaxage[1], 10)
  const maxAge = /max-age=(\d+)/.exec(cacheControl)
  if (maxAge?.[1]) return Number.parseInt(maxAge[1], 10)
  return undefined
}

/**
 * Build a standalone {@link CacheApiLike} LRU. Exported so callers can wire it
 * somewhere other than `globalThis` (tests, multi-tenant isolation).
 */
export function createCachesShim(options: InstallCachesShimOptions): CacheApiLike {
  const store = new Map<string, CacheEntry>()

  return {
    async match(request) {
      const key = keyFor(request)
      const entry = store.get(key)
      if (!entry) return undefined
      if (entry.expiresAt <= Date.now()) {
        store.delete(key)
        return undefined
      }
      // refresh recency
      store.delete(key)
      store.set(key, entry)
      const headers = new Headers(entry.headers)
      return new Response(entry.body.slice(), { status: entry.status, headers })
    },
    async put(request, response) {
      const ttl = freshnessSeconds(response)
      if (ttl === undefined || ttl <= 0) return
      const buffer = new Uint8Array(await response.clone().arrayBuffer())
      if (options.maxBytes !== undefined && buffer.byteLength > options.maxBytes) return
      const headers: Array<[string, string]> = []
      response.headers.forEach((value, name) => {
        headers.push([name, value])
      })
      const key = keyFor(request)
      if (store.has(key)) store.delete(key)
      store.set(key, {
        status: response.status,
        headers,
        body: buffer,
        expiresAt: Date.now() + ttl * 1000,
      })
      while (store.size > options.maxEntries) {
        const oldest = store.keys().next().value
        if (oldest === undefined) break
        store.delete(oldest)
      }
    },
  }
}

interface CachesGlobal {
  caches?: { default?: CacheApiLike }
}

/**
 * Install {@link createCachesShim} at `globalThis.caches.default`. Idempotent:
 * a second call returns the already-installed shim rather than replacing it, so
 * repeated boots (or multiple entrypoints in one process) share one cache.
 * Returns the active {@link CacheApiLike}.
 */
export function installCachesShim(options: InstallCachesShimOptions): CacheApiLike {
  const globalRef = globalThis as CachesGlobal
  const existing = globalRef.caches?.default
  if (existing) return existing
  const shim = createCachesShim(options)
  globalRef.caches = { ...(globalRef.caches ?? {}), default: shim }
  return shim
}

/** Test hook — remove the installed shim so a fresh one can be installed. */
export function uninstallCachesShim(): void {
  const globalRef = globalThis as CachesGlobal
  if (globalRef.caches) delete globalRef.caches.default
}

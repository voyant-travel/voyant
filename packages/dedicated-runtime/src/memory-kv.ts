/**
 * An in-process `KVNamespace`-shaped store for a resident Node deployment.
 *
 * On Cloudflare Workers the `KV` binding is injected by the runtime; on a
 * Node-only operator there is no binding and — with no Workers lane — nothing
 * to emulate. A resident process instead holds its own map, so hot reads never
 * leave the process. The surface is kept identical to the binding the operator
 * packages already use (`env.CACHE` / `env.RATE_LIMIT`): `get(key)`,
 * `get(key, "json")`, `put(key, value, { expirationTtl })`, `delete(key)` — so
 * the same middleware (`publicResponseCache`, `rateLimit`, auth caches) runs
 * unchanged against `KVStore` (`@voyant-travel/utils`).
 *
 * This is a single-process store: entries live only in the process that wrote
 * them. That is the correct model for the dedicated per-app runtime (one
 * resident process per deployment). A future multi-instance deployment swaps
 * this for a shared KV/Redis provider behind the same interface (platform#940).
 */

export type KvValueType = "text" | "json"

export interface KvGetOptions {
  type?: KvValueType
}

export interface KvPutOptions {
  /** TTL in seconds — the entry is treated as absent once it elapses. */
  expirationTtl?: number
}

/** Minimal `KVNamespace` surface consumed across the operator packages. */
export interface KvNamespaceShim {
  get(key: string): Promise<string | null>
  get<T = unknown>(key: string, type: "json"): Promise<T | null>
  get<T = unknown>(key: string, options: KvGetOptions): Promise<T | string | null>
  put(key: string, value: string, options?: KvPutOptions): Promise<void>
  delete(key: string): Promise<void>
}

export interface MemoryKvOptions {
  /**
   * Cap on resident entries before least-recently-used eviction. A resident
   * process is long-lived, so an unbounded map would grow without limit;
   * defaults to 10,000. Set `0` to disable eviction (unbounded).
   */
  maxEntries?: number
  /** Injectable clock (ms) for deterministic TTL tests. Defaults to `Date.now`. */
  now?: () => number
}

interface Entry {
  value: string
  /** Absolute expiry (ms), or `Infinity` for no TTL. */
  expiresAt: number
}

const DEFAULT_MAX_ENTRIES = 10_000

/**
 * Build an in-process {@link KvNamespaceShim}. Backed by a `Map` with per-entry
 * TTL and LRU eviction — the real Node KV, not a shim over a remote binding.
 */
export function createMemoryKvNamespace(options: MemoryKvOptions = {}): KvNamespaceShim {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  const now = options.now ?? Date.now
  const map = new Map<string, Entry>()

  function readFresh(key: string): string | null {
    const entry = map.get(key)
    if (!entry) return null
    if (entry.expiresAt <= now()) {
      map.delete(key)
      return null
    }
    // Refresh recency for LRU.
    map.delete(key)
    map.set(key, entry)
    return entry.value
  }

  async function get(
    key: string,
    typeOrOptions?: "json" | KvGetOptions,
  ): Promise<string | null | unknown> {
    const type = typeof typeOrOptions === "string" ? typeOrOptions : (typeOrOptions?.type ?? "text")
    const raw = readFresh(key)
    if (raw === null) return null
    return type === "json" ? JSON.parse(raw) : raw
  }

  return {
    get: get as KvNamespaceShim["get"],
    async put(key: string, value: string, putOptions?: KvPutOptions): Promise<void> {
      if (map.has(key)) map.delete(key)
      const expiresAt =
        putOptions?.expirationTtl === undefined
          ? Number.POSITIVE_INFINITY
          : now() + putOptions.expirationTtl * 1000
      map.set(key, { value, expiresAt })
      if (maxEntries > 0) {
        while (map.size > maxEntries) {
          const oldest = map.keys().next().value
          if (oldest === undefined) break
          map.delete(oldest)
        }
      }
    },
    async delete(key: string): Promise<void> {
      map.delete(key)
    },
  }
}

/**
 * A `KVNamespace`-shaped client backed by the Cloudflare KV REST API, plus an
 * optional in-process read-through LRU. On Workers-for-Platforms the `KV`
 * binding is injected by the runtime; on a dedicated Node process there is no
 * binding, so app code talks to the same namespace over HTTPS. The shim keeps
 * the surface identical to the binding the operator packages already use:
 * `get(key)`, `get(key, "json")`, `put(key, value, { expirationTtl })`,
 * `delete(key)`.
 */

/** Injectable fetch — matches the global `fetch`. Tests stub this. */
export type KvFetch = typeof fetch

export type KvValueType = "text" | "json"

export interface KvGetOptions {
  type?: KvValueType
}

export interface KvPutOptions {
  /** TTL in seconds; forwarded as the `expiration_ttl` query param. */
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

export interface KvLruOptions {
  /** Maximum number of resident entries before least-recently-used eviction. */
  maxEntries: number
  /** How long a cached read stays fresh, in milliseconds. */
  ttlMs: number
}

export interface KvNamespaceShimOptions {
  accountId: string
  namespaceId: string
  apiToken: string
  /** Override the fetch implementation (tests / custom agents). */
  fetchImpl?: KvFetch
  /** Override the REST API base (defaults to the public Cloudflare API). */
  baseUrl?: string
  /**
   * Enable a small in-process read-through LRU. A resident Node process can
   * finally hold one — REST round-trips are tens of ms, so caching hot keys is
   * a large win. Writes and deletes keep the LRU coherent.
   */
  lru?: KvLruOptions
}

const DEFAULT_BASE_URL = "https://api.cloudflare.com/client/v4"

interface LruEntry {
  value: string | null
  expiresAt: number
}

function createLru(options: KvLruOptions) {
  const map = new Map<string, LruEntry>()
  return {
    get(key: string): { value: string | null } | undefined {
      const entry = map.get(key)
      if (!entry) return undefined
      if (entry.expiresAt <= Date.now()) {
        map.delete(key)
        return undefined
      }
      // refresh recency
      map.delete(key)
      map.set(key, entry)
      return { value: entry.value }
    },
    set(key: string, value: string | null): void {
      if (map.has(key)) map.delete(key)
      map.set(key, { value, expiresAt: Date.now() + options.ttlMs })
      while (map.size > options.maxEntries) {
        const oldest = map.keys().next().value
        if (oldest === undefined) break
        map.delete(oldest)
      }
    },
    delete(key: string): void {
      map.delete(key)
    },
  }
}

/**
 * Build a {@link KvNamespaceShim} over the Cloudflare KV REST API.
 */
export function createKvNamespaceShim(options: KvNamespaceShimOptions): KvNamespaceShim {
  const fetchImpl = options.fetchImpl ?? fetch
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "")
  const lru = options.lru ? createLru(options.lru) : undefined
  const authHeaders = { authorization: `Bearer ${options.apiToken}` }

  function valueUrl(key: string): string {
    return (
      `${baseUrl}/accounts/${encodeURIComponent(options.accountId)}` +
      `/storage/kv/namespaces/${encodeURIComponent(options.namespaceId)}` +
      `/values/${encodeURIComponent(key)}`
    )
  }

  async function readRaw(key: string): Promise<string | null> {
    const cached = lru?.get(key)
    if (cached) return cached.value
    const response = await fetchImpl(valueUrl(key), {
      method: "GET",
      headers: authHeaders,
    })
    if (response.status === 404) {
      lru?.set(key, null)
      return null
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`KV get failed (${response.status}): ${text}`)
    }
    const value = await response.text()
    lru?.set(key, value)
    return value
  }

  function parse(raw: string | null, type: KvValueType | undefined): unknown {
    if (raw === null) return null
    if (type === "json") return JSON.parse(raw)
    return raw
  }

  async function get(
    key: string,
    typeOrOptions?: "json" | KvGetOptions,
  ): Promise<string | null | unknown> {
    const type = typeof typeOrOptions === "string" ? typeOrOptions : (typeOrOptions?.type ?? "text")
    const raw = await readRaw(key)
    return parse(raw, type)
  }

  return {
    get: get as KvNamespaceShim["get"],
    async put(key: string, value: string, putOptions?: KvPutOptions): Promise<void> {
      const url = new URL(valueUrl(key))
      if (putOptions?.expirationTtl !== undefined) {
        url.searchParams.set("expiration_ttl", String(putOptions.expirationTtl))
      }
      const response = await fetchImpl(url.toString(), {
        method: "PUT",
        headers: authHeaders,
        body: value,
      })
      if (!response.ok) {
        const text = await response.text().catch(() => "")
        throw new Error(`KV put failed (${response.status}): ${text}`)
      }
      lru?.set(key, value)
    },
    async delete(key: string): Promise<void> {
      const response = await fetchImpl(valueUrl(key), {
        method: "DELETE",
        headers: authHeaders,
      })
      if (!response.ok && response.status !== 404) {
        const text = await response.text().catch(() => "")
        throw new Error(`KV delete failed (${response.status}): ${text}`)
      }
      lru?.delete(key)
    },
  }
}

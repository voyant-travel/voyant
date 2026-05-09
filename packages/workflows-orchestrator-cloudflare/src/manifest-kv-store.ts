// KV-backed manifest store for the Cloudflare orchestrator.
//
// Mirrors the Mode 2 ManifestStore contract from
// `@voyantjs/workflows-orchestrator-node`'s `createPostgresManifestStore`,
// just against KV instead of Postgres. Both are consumed by their
// respective driver factories — the orchestrator's `WorkflowDriver`
// shape is identical.
//
// Layout in KV:
//
//   manifest:<environment>:<versionId>      → JSON-serialized manifest
//   manifest:<environment>:current          → versionId of the active manifest
//
// Idempotent: same `(environment, versionId)` overwrite is fine.
// Latest N versions retained via `pruneToVersions(env, n)`. KV is
// eventually consistent (~60s globally), which is acceptable for the
// manifest read path (manifests change at deploy boundaries, not per
// event).

// ---- Public types ----

/**
 * Structural view of a `WorkflowManifest` envelope. Mirrors the shape
 * `@voyantjs/workflows-orchestrator-node`'s manifest store uses, declared
 * locally so this package stays free of the Mode 2 dep.
 */
export interface CfManifestEnvelope {
  environment: string
  versionId: string
  manifest: Record<string, unknown>
}

export interface CfManifestStore {
  registerManifest(envelope: CfManifestEnvelope): Promise<{ versionId: string }>
  getCurrent(environment: string): Promise<CfManifestEnvelope | null>
  pruneToVersions(environment: string, keep: number): Promise<{ deleted: number }>
}

/**
 * Subset of the CF KV namespace API we need. Declared structurally so
 * tests can pass an in-memory fake without depending on
 * `@cloudflare/workers-types`.
 */
export interface KvNamespaceLike {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { metadata?: unknown }): Promise<void>
  delete(key: string): Promise<void>
  list(opts?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string; metadata?: unknown }>
    list_complete?: boolean
    cursor?: string
  }>
}

export interface CreateKvManifestStoreOptions {
  /** KV namespace binding from the worker's env. */
  kv: KvNamespaceLike
}

// ---- Public factory ----

/**
 * Build a KV-backed `CfManifestStore`. Stateless — every call hits KV.
 */
export function createKvManifestStore(opts: CreateKvManifestStoreOptions): CfManifestStore {
  const kv = opts.kv

  return {
    async registerManifest(envelope) {
      const versionKey = manifestVersionKey(envelope.environment, envelope.versionId)
      const currentKey = manifestCurrentKey(envelope.environment)

      // Idempotent overwrite — same body produces the same byte content
      // because manifests are content-addressed (versionId derives from
      // a sha256 of the canonicalized manifest in the SDK).
      await kv.put(versionKey, JSON.stringify(envelope.manifest))
      await kv.put(currentKey, envelope.versionId)

      return { versionId: envelope.versionId }
    },

    async getCurrent(environment) {
      const currentKey = manifestCurrentKey(environment)
      const versionId = await kv.get(currentKey)
      if (!versionId) return null

      const versionKey = manifestVersionKey(environment, versionId)
      const raw = await kv.get(versionKey)
      if (!raw) return null

      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>
      } catch {
        return null
      }
      return {
        environment,
        versionId,
        manifest: parsed,
      }
    },

    async pruneToVersions(environment, keep) {
      if (keep < 1) {
        throw new Error(`pruneToVersions: keep must be >= 1, got ${keep}`)
      }
      // List every version key for this environment; sort so we can drop
      // older entries. Lexicographic sort is fine because the SDK's
      // versionId is a hex string of the same length, and KV's natural
      // order is also lexicographic. For deterministic semantics we
      // additionally fetch the `current` pointer and always keep that.
      const prefix = `manifest:${environment}:`
      const list = await kv.list({ prefix, limit: 1000 })
      const versionKeys = list.keys.map((k) => k.name).filter((name) => !name.endsWith(":current"))

      // Sort newest-first (lexicographic descending).
      versionKeys.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))

      const currentVersion = await kv.get(manifestCurrentKey(environment))
      const currentKey = currentVersion
        ? manifestVersionKey(environment, currentVersion)
        : undefined

      const keepers = new Set<string>()
      if (currentKey) keepers.add(currentKey)
      for (const k of versionKeys) {
        if (keepers.size >= keep) break
        keepers.add(k)
      }

      let deleted = 0
      for (const k of versionKeys) {
        if (keepers.has(k)) continue
        await kv.delete(k)
        deleted++
      }
      return { deleted }
    },
  }
}

// ---- Key helpers ----

function manifestVersionKey(environment: string, versionId: string): string {
  return `manifest:${environment}:${versionId}`
}

function manifestCurrentKey(environment: string): string {
  return `manifest:${environment}:current`
}

// ---- In-memory KV fake (test-only) ----

/**
 * Tiny in-memory implementation of `KvNamespaceLike` for tests + the CF
 * compliance suite run that doesn't go through wrangler. Mirrors the
 * subset of CF KV semantics we use (list returns matching prefix in
 * lexicographic order; get returns null for missing keys).
 */
export function createInMemoryKv(): KvNamespaceLike {
  const map = new Map<string, string>()
  return {
    async get(key) {
      return map.has(key) ? (map.get(key) as string) : null
    },
    async put(key, value) {
      map.set(key, value)
    },
    async delete(key) {
      map.delete(key)
    },
    async list(opts) {
      const prefix = opts?.prefix ?? ""
      const limit = opts?.limit ?? 1000
      const matching = [...map.keys()]
        .filter((k) => k.startsWith(prefix))
        .sort()
        .slice(0, limit)
      return {
        keys: matching.map((name) => ({ name })),
        list_complete: true,
      }
    },
  }
}

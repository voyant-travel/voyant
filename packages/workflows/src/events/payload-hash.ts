// Canonical JSON + SHA-256 helpers used to derive `payloadHash` ids for
// `EventFilterRuntimeEntry` and `WorkflowManifest.versionId`.
//
// Canonicalization recursively alphabetizes object keys before
// JSON.stringify. SHA-256 uses Web Crypto (`globalThis.crypto.subtle`),
// available on Node ≥ 19, all modern browsers, and Cloudflare Workers.
// Async because Web Crypto's digest is async — callers `await` once
// at registration time.
//
// Architecture: docs/architecture/workflows-runtime-architecture.md §13.3.

/**
 * Recursively alphabetize object keys, leaving arrays and primitives intact.
 * `undefined` is converted to `null` so canonical JSON shape is stable
 * (JSON.stringify drops `undefined` from objects).
 */
export function canonicalize(value: unknown): unknown {
  if (value === undefined) return null
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }
  const sorted: Record<string, unknown> = {}
  const keys = Object.keys(value as Record<string, unknown>).sort()
  for (const k of keys) {
    sorted[k] = canonicalize((value as Record<string, unknown>)[k])
  }
  return sorted
}

/**
 * Stable canonical JSON string for `value`. Two values that are deeply
 * equal modulo key order produce identical strings; two values that
 * differ in any way produce different strings. Used as the input to
 * `sha256(...)` for content-derived ids.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

/**
 * SHA-256 hex digest of an arbitrary value (canonicalized first). Async
 * — callers await once during manifest build.
 *
 * @returns lowercase hex string, 64 chars long.
 */
export async function sha256(value: unknown): Promise<string> {
  const text = canonicalJson(value)
  const bytes = new TextEncoder().encode(text)
  const digest = await getCrypto().subtle.digest("SHA-256", bytes)
  return bytesToHex(new Uint8Array(digest))
}

/**
 * Short content-derived id, used as `EventFilterManifestEntry.payloadHash`
 * and `WorkflowManifest.versionId`. 16 hex chars (~64 bits) — collision
 * space is fine for human-friendly ids in dashboards/logs; the canonical
 * full hash is `sha256(...)` if you need it.
 */
export async function shortHash(value: unknown): Promise<string> {
  const full = await sha256(value)
  return full.slice(0, 16)
}

/**
 * Derive a stable event id from an envelope when `metadata.eventId` is
 * absent. Mirrors the formula from architecture doc §15.2:
 *
 *     `${name}:${emittedAt}:${sha256(canonical(data)).slice(0, 12)}`
 *
 * Same envelope content always produces the same id — concurrent retries
 * of the same external HTTP delivery dedupe at the driver's
 * `${filterId}:${eventId}` idempotency key derivation.
 *
 * Returns a fallback id of the form `evt_<name>_<emittedAt>_<hash12>`
 * (URL-safe; no colons in case the id flows through path segments).
 */
export async function deriveStableEventId(envelope: {
  name: string
  data: unknown
  emittedAt: string
}): Promise<string> {
  const dataHash = (await sha256(envelope.data)).slice(0, 12)
  const safeName = envelope.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const safeAt = envelope.emittedAt.replace(/[^a-zA-Z0-9.]/g, "_")
  return `evt_${safeName}_${safeAt}_${dataHash}`
}

// ---- Internal ----

function getCrypto(): Crypto {
  // `globalThis.crypto` is available on Node 19+, Workers, browsers.
  // Any environment older than that needs a polyfill at the consumer level.
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (!c?.subtle) {
    throw new Error(
      "@voyantjs/workflows/events: globalThis.crypto.subtle is required for payload-hash. " +
        "Polyfill via webcrypto on legacy runtimes.",
    )
  }
  return c
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ""
  for (let i = 0; i < bytes.length; i++) {
    out += (bytes[i] ?? 0).toString(16).padStart(2, "0")
  }
  return out
}

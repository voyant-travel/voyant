/**
 * Unified key parser for cruise admin routes.
 *
 * The same admin endpoint (e.g. `GET /v1/admin/cruises/:key`) accepts both
 * local TypeIDs (`cru_abc123…`) and external adapter-scoped keys
 * (`<provider>:<ref>`, e.g. `voyant-connect:cnx_xx/extId`). The parser
 * normalises the URL parameter into a discriminated union so route handlers
 * can dispatch to the local DB or to an adapter.
 *
 * Phase 2 only handles `kind: 'local'`; external keys return 501. Phase 3
 * wires the adapter contract.
 */

export type ParsedKey =
  | { kind: "local"; id: string }
  | { kind: "external"; provider: string; ref: string }
  | { kind: "invalid"; raw: string }

const TYPEID_RE = /^[a-z]+_[0-9a-zA-Z]+$/
const ENCODED_SOURCE_REF_PREFIX = "sr_"

export type EncodableSourceRef = {
  externalId: string
  connectionId?: string
  [key: string]: unknown
}

export function parseUnifiedKey(raw: string): ParsedKey {
  const decoded = decodeURIComponent(raw)
  const colon = decoded.indexOf(":")
  if (colon > 0) {
    const provider = decoded.slice(0, colon)
    const ref = decoded.slice(colon + 1)
    if (provider && ref) return { kind: "external", provider, ref }
    return { kind: "invalid", raw: decoded }
  }
  // Catalog sourced entity id (`<prefix>_sr_<base64url>`) — the id the catalog
  // plane builds for sourced cruises (`buildEntityId`) and indexes. It carries
  // a second underscore (and base64url `-`/`_`) the TypeID regex rejects, so
  // detect it explicitly and pass it through as the entity id.
  if (isEncodedSourceEntityId(decoded)) return { kind: "local", id: decoded }
  if (TYPEID_RE.test(decoded)) return { kind: "local", id: decoded }
  return { kind: "invalid", raw: decoded }
}

/**
 * True when `id` is a catalog sourced entity id: a TypeID prefix followed by an
 * encoded SourceRef (`<prefix>_sr_<base64url>`). Distinguishes sourced ids from
 * owned TypeIDs so content routes dispatch sourced ids without the owned-key
 * opt-in. See `cruiseAdapterToSourceAdapter`'s `buildEntityId`.
 */
export function isEncodedSourceEntityId(id: string): boolean {
  const underscore = id.indexOf("_")
  if (underscore <= 0) return false
  return decodeSourceRef(id.slice(underscore + 1)) !== null
}

export function makeExternalSourceKey(provider: string, sourceRef: EncodableSourceRef): string {
  return `${provider}:${encodeSourceRef(sourceRef)}`
}

export function encodeSourceRef(sourceRef: EncodableSourceRef): string {
  return `${ENCODED_SOURCE_REF_PREFIX}${base64UrlEncode(stableStringify(sourceRef))}`
}

export function decodeSourceRef(encoded: string): EncodableSourceRef | null {
  if (!encoded.startsWith(ENCODED_SOURCE_REF_PREFIX)) return null
  try {
    const decoded = JSON.parse(base64UrlDecode(encoded.slice(ENCODED_SOURCE_REF_PREFIX.length)))
    if (
      decoded &&
      typeof decoded === "object" &&
      typeof (decoded as { externalId?: unknown }).externalId === "string"
    ) {
      return decoded as EncodableSourceRef
    }
  } catch {
    // Invalid encoded refs are treated as legacy raw external ids by callers.
  }
  return null
}

export function sourceRefFromExternalKeyRef(ref: string): EncodableSourceRef {
  return decodeSourceRef(ref) ?? { externalId: ref }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== "object") return value
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) {
    out[key] = sortValue((value as Record<string, unknown>)[key])
  }
  return out
}

function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlDecode(input: string): string {
  const padded = input.padEnd(Math.ceil(input.length / 4) * 4, "=")
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

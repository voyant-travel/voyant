// Compile an `EventFilterDeclaration` (authored in user code) into an
// `EventFilterRuntimeEntry`. Validates the predicate + mapper at
// registration time so authoring errors fail fast; computes the
// content-derived `id` / `payloadHash` so the manifest is deterministic.
//
// Called from `trigger.on(...)` in `../trigger.js`.

import type { EventFilterManifestEntry } from "../protocol/index.js"
import type { EventFilterDeclaration } from "../trigger.js"
import { type InputMapper, validateInputMapper } from "./input-mapper.js"
import { canonicalJson, sha256 } from "./payload-hash.js"
import { type PredicateExpr, validatePredicate } from "./predicate.js"
import { type EventFilterRuntimeEntry, getEventFilterRegistry } from "./registry.js"

export class EventFilterCompileError extends Error {
  readonly errors: string[]

  constructor(message: string, errors: string[] = []) {
    super(message)
    this.name = "EventFilterCompileError"
    this.errors = errors
  }
}

/**
 * Compile an authored declaration into a runtime entry. Throws
 * `EventFilterCompileError` on shape errors so authoring problems fail
 * at module-load time.
 */
export async function compileEventFilter<T>(
  eventType: string,
  declaration: EventFilterDeclaration<T>,
): Promise<EventFilterRuntimeEntry> {
  if (typeof eventType !== "string" || eventType.length === 0) {
    throw new EventFilterCompileError(
      `trigger.on(eventType, ...): eventType must be a non-empty string`,
    )
  }
  if (typeof declaration !== "object" || declaration === null) {
    throw new EventFilterCompileError(
      `trigger.on("${eventType}", ...): declaration must be an object`,
    )
  }
  if (!declaration.target || typeof declaration.target !== "object") {
    throw new EventFilterCompileError(
      `trigger.on("${eventType}", ...): "target" must be a workflow definition (got ${typeof declaration.target})`,
    )
  }
  const targetWorkflowId =
    typeof (declaration.target as { id?: unknown }).id === "string"
      ? (declaration.target as { id: string }).id
      : ""
  if (targetWorkflowId.length === 0) {
    throw new EventFilterCompileError(
      `trigger.on("${eventType}", ...): "target.id" must be a non-empty string`,
    )
  }

  // Validate `where` if supplied.
  const where = (declaration as { where?: PredicateExpr }).where
  if (where !== undefined) {
    const result = validatePredicate(where)
    if (!result.ok) {
      throw new EventFilterCompileError(
        `trigger.on("${eventType}", target=${targetWorkflowId}): invalid where clause`,
        result.errors,
      )
    }
  }

  // Validate `input` if supplied.
  const input = (declaration as { input?: InputMapper }).input
  if (input !== undefined) {
    const result = validateInputMapper(input)
    if (!result.ok) {
      throw new EventFilterCompileError(
        `trigger.on("${eventType}", target=${targetWorkflowId}): invalid input mapper`,
        result.errors,
      )
    }
  }

  // Reject the legacy `match` callback explicitly so authoring errors are obvious.
  if (typeof (declaration as { match?: unknown }).match === "function") {
    throw new EventFilterCompileError(
      `trigger.on("${eventType}"): the "match" callback is no longer supported. ` +
        `Use the structured "where" predicate instead. See architecture doc §12.`,
    )
  }

  // Canonical content-derived id. Stable across re-deploys because the
  // canonicalized JSON of the declaration is identical for byte-equivalent
  // sources.
  const canonicalDeclaration = {
    eventType,
    where: where ?? null,
    input: input ?? null,
    targetWorkflowId,
  }
  const fullHash = await sha256(canonicalDeclaration)
  const payloadHash = fullHash
  // Filter id seeds from the same hash but stays human-friendly in logs.
  const id = `ef_${fullHash.slice(0, 16)}`

  const manifest: EventFilterManifestEntry = {
    id,
    eventType,
    payloadHash,
    targetWorkflowId,
    ...(where !== undefined ? { where } : {}),
    ...(input !== undefined ? { input } : {}),
  }

  const entry: EventFilterRuntimeEntry = {
    id,
    eventType,
    manifest,
    declaration: declaration as EventFilterDeclaration<unknown>,
    targetWorkflowId,
  }
  return entry
}

/**
 * Compile + register in one step. The synchronous wrapper for `trigger.on()`
 * that user code calls — kicks off compile asynchronously, registers when
 * the entry is ready, and returns a handle the user can ignore. Validation
 * errors become unhandled-rejection warnings in dev (caught by vitest etc.)
 * and surface at boot via `manifestBuilder.buildManifest()` which awaits
 * registry settlement.
 *
 * For the synchronous-handle return we use a placeholder id; the real id
 * lands when the compile resolves. Since `trigger.on()` is the user-facing
 * API and most users don't inspect the returned handle (they just want the
 * filter registered), this is fine. If a future caller needs the real id
 * synchronously, see {@link compileEventFilterSync} below.
 */
export function compileAndRegister<T>(
  eventType: string,
  declaration: EventFilterDeclaration<T>,
): { id: string; readonly event: string } {
  // Run validation + compile synchronously where possible. The async
  // boundary is the SHA-256 digest from Web Crypto; we bridge via a
  // synchronous canonical-JSON hash so trigger.on() can stay sync.
  const entry = compileEventFilterSync(eventType, declaration)
  getEventFilterRegistry().add(entry)
  return { id: entry.id, event: entry.eventType }
}

/**
 * Synchronous compile — uses a deterministic but non-cryptographic hash
 * over the canonical JSON. Suitable for the registry id (we just need
 * stable + collision-resistant-enough across realistic registration
 * counts). The crypto-grade `sha256(...)` is used at *manifest build*
 * time when async is fine.
 */
export function compileEventFilterSync<T>(
  eventType: string,
  declaration: EventFilterDeclaration<T>,
): EventFilterRuntimeEntry {
  if (typeof eventType !== "string" || eventType.length === 0) {
    throw new EventFilterCompileError(
      `trigger.on(eventType, ...): eventType must be a non-empty string`,
    )
  }
  if (typeof declaration !== "object" || declaration === null) {
    throw new EventFilterCompileError(
      `trigger.on("${eventType}", ...): declaration must be an object`,
    )
  }
  if (!declaration.target || typeof declaration.target !== "object") {
    throw new EventFilterCompileError(
      `trigger.on("${eventType}", ...): "target" must be a workflow definition (got ${typeof declaration.target})`,
    )
  }
  const targetWorkflowId =
    typeof (declaration.target as { id?: unknown }).id === "string"
      ? (declaration.target as { id: string }).id
      : ""
  if (targetWorkflowId.length === 0) {
    throw new EventFilterCompileError(
      `trigger.on("${eventType}", ...): "target.id" must be a non-empty string`,
    )
  }

  const where = (declaration as { where?: PredicateExpr }).where
  if (where !== undefined) {
    const result = validatePredicate(where)
    if (!result.ok) {
      throw new EventFilterCompileError(
        `trigger.on("${eventType}", target=${targetWorkflowId}): invalid where clause`,
        result.errors,
      )
    }
  }

  const input = (declaration as { input?: InputMapper }).input
  if (input !== undefined) {
    const result = validateInputMapper(input)
    if (!result.ok) {
      throw new EventFilterCompileError(
        `trigger.on("${eventType}", target=${targetWorkflowId}): invalid input mapper`,
        result.errors,
      )
    }
  }

  if (typeof (declaration as { match?: unknown }).match === "function") {
    throw new EventFilterCompileError(
      `trigger.on("${eventType}"): the "match" callback is no longer supported. ` +
        `Use the structured "where" predicate instead. See architecture doc §12.`,
    )
  }

  const canonicalDeclaration = {
    eventType,
    where: where ?? null,
    input: input ?? null,
    targetWorkflowId,
  }
  const json = canonicalJson(canonicalDeclaration)
  const shortId = nonCryptoHash16(json)
  const id = `ef_${shortId}`

  const manifest: EventFilterManifestEntry = {
    id,
    eventType,
    // payloadHash on the manifest is stable (same canonical JSON) but
    // upgraded to the crypto-grade sha256 at manifest-build time. Until
    // then it carries the same short hash so consumers that read it pre-
    // build (e.g. dashboards in dev mode) still see something sensible.
    payloadHash: shortId,
    targetWorkflowId,
    ...(where !== undefined ? { where } : {}),
    ...(input !== undefined ? { input } : {}),
  }

  return {
    id,
    eventType,
    manifest,
    declaration: declaration as EventFilterDeclaration<unknown>,
    targetWorkflowId,
  }
}

/**
 * Deterministic 16-hex-char hash for synchronous registration. Uses FNV-1a
 * 64-bit folded into hex — collision-resistant enough at the cardinality of
 * "filters per project" (low thousands at most). The cryptographic SHA-256
 * is the source of truth for manifest-level identity; this is just enough
 * to be a stable id for the in-process registry.
 */
function nonCryptoHash16(text: string): string {
  // FNV-1a 64-bit, computed as two 32-bit halves to avoid bigint overhead
  // in tight loops. Output: 16 hex chars (concatenation of the two halves).
  let h1 = 0xcbf29ce4
  let h2 = 0x84222325
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = (h1 ^ c) >>> 0
    h2 = (h2 ^ c) >>> 0
    // Multiply by 0x100000001b3 split into the two halves.
    const lo = h2 * 0x01b3
    const hi = h1 * 0x01b3 + Math.floor(lo / 0x100000000)
    h2 = (lo & 0xffffffff) >>> 0
    h1 = hi >>> 0
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")
}

// Compile an `EventFilterDeclaration` (authored in user code) into an
// `EventFilterRuntimeEntry`. Validates the predicate + mapper at
// registration time so authoring errors fail fast; computes the
// content-derived `id` / `payloadHash` so the manifest is deterministic.
//
// Called from `trigger.on(...)` in `../trigger.js`.

import type { EventFilterManifestEntry } from "../protocol/index.js"
import type { EventFilterDeclaration } from "../trigger.js"
import { type InputMapper, validateInputMapper } from "./input-mapper.js"
import { canonicalJson } from "./payload-hash.js"
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
 * Compile + register in one step. The synchronous wrapper for `trigger.on()`
 * that user code calls — validates the declaration, computes the
 * content-derived id, registers the entry, and returns it.
 *
 * Returning the full {@link EventFilterRuntimeEntry} is what makes the
 * authoring shape from the architecture doc work directly — modules can
 * write `eventFilters: [trigger.on(...)]` without a registry round-trip:
 * the entry already structurally satisfies `EventFilterDescriptor`
 * (matching `id` + `eventType` fields) and carries the `manifest` payload
 * `createApp()`'s wireWorkflowRuntime needs to register with the driver.
 */
export function compileAndRegister<T>(
  eventType: string,
  declaration: EventFilterDeclaration<T>,
): EventFilterRuntimeEntry {
  // Run validation + compile synchronously where possible. The async
  // boundary is the SHA-256 digest from Web Crypto; we bridge via a
  // synchronous canonical-JSON hash so trigger.on() can stay sync.
  const entry = compileEventFilterSync(eventType, declaration)
  getEventFilterRegistry().add(entry)
  return entry
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

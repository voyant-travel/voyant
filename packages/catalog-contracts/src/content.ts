/**
 * Pure sourced-content primitives for consumers that validate or compose
 * adapter content payloads without depending on the catalog runtime package.
 */

import { z } from "zod"

export const BOARD_BASIS_VALUES = [
  "room_only",
  "bed_breakfast",
  "half_board",
  "full_board",
  "all_inclusive",
] as const

export const boardBasisSchema = z.enum(BOARD_BASIS_VALUES)

export type BoardBasis = z.infer<typeof boardBasisSchema>

export const BOARD_BASIS_SHORT_CODES = {
  room_only: "RO",
  bed_breakfast: "BB",
  half_board: "HB",
  full_board: "FB",
  all_inclusive: "AI",
} as const satisfies Record<BoardBasis, string>

export type BoardBasisShortCode =
  (typeof BOARD_BASIS_SHORT_CODES)[keyof typeof BOARD_BASIS_SHORT_CODES]

export const BOARD_BASIS_FROM_SHORT_CODE = {
  RO: "room_only",
  BB: "bed_breakfast",
  HB: "half_board",
  FB: "full_board",
  AI: "all_inclusive",
} as const satisfies Record<BoardBasisShortCode, BoardBasis>

export function isStale(
  row: { fresh_until: Date | null | undefined },
  now: Date = new Date(),
): boolean {
  if (!row.fresh_until) return false
  return row.fresh_until.getTime() <= now.getTime()
}

export type ContentLocaleMatchKind = "exact" | "language_match" | "fallback_chain" | "any"

export interface ContentLocaleResolution<T> {
  candidate: T
  served_locale: string
  match_kind: ContentLocaleMatchKind
}

export function pickBestCachedLocale<T extends { locale: string }>(
  candidates: ReadonlyArray<T>,
  preferredLocales: ReadonlyArray<string>,
): ContentLocaleResolution<T> | null {
  if (candidates.length === 0) return null

  let best: { candidate: T; rank: number; match: ContentLocaleMatchKind } | null = null

  for (const candidate of candidates) {
    let rank: number | null = null
    let match: ContentLocaleMatchKind = "any"

    for (let i = 0; i < preferredLocales.length; i += 1) {
      const pref = preferredLocales[i]!
      if (candidate.locale === pref) {
        rank = i
        match = "exact"
        break
      }
      if (languageTag(candidate.locale) === languageTag(pref)) {
        if (rank === null || i < rank) {
          rank = i
          match = "language_match"
        }
      }
    }

    if (rank === null) {
      rank = preferredLocales.length
      match = "any"
    }

    if (
      !best ||
      rank < best.rank ||
      (rank === best.rank && matchScore(match) > matchScore(best.match))
    ) {
      best = { candidate, rank, match }
    }
  }

  if (!best) return null

  let final: ContentLocaleMatchKind = best.match
  if (final === "any" && preferredLocales.length > 0) {
    final = "fallback_chain"
  }

  return {
    candidate: best.candidate,
    served_locale: best.candidate.locale,
    match_kind: final,
  }
}

function languageTag(locale: string): string {
  return locale.split("-")[0]!.toLowerCase()
}

function matchScore(match: ContentLocaleMatchKind): number {
  switch (match) {
    case "exact":
      return 3
    case "language_match":
      return 2
    case "fallback_chain":
      return 1
    case "any":
      return 0
  }
}

export class JsonPointerError extends Error {
  constructor(
    public readonly pointer: string,
    public readonly reason: string,
  ) {
    super(`json-pointer ${pointer}: ${reason}`)
    this.name = "JsonPointerError"
  }
}

export function parseJsonPointer(pointer: string): string[] {
  if (pointer === "") return []
  if (!pointer.startsWith("/")) {
    throw new JsonPointerError(pointer, "must start with '/' or be empty")
  }
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
}

export function applyJsonPointerOverlay(target: unknown, pointer: string, value: unknown): unknown {
  const segments = parseJsonPointer(pointer)
  if (segments.length === 0) {
    return value
  }

  let cursor: unknown = target
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]!
    cursor = stepInto(cursor, segment, pointer)
  }
  const lastSegment = segments[segments.length - 1]!
  setAt(cursor, lastSegment, value, pointer)
  return target
}

function stepInto(node: unknown, segment: string, pointer: string): unknown {
  if (Array.isArray(node)) {
    const idx = parseArrayIndex(segment, pointer)
    const next = node[idx]
    if (next === undefined) {
      throw new JsonPointerError(pointer, `array index ${idx} out of range`)
    }
    return next
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>
    if (!(segment in obj)) {
      throw new JsonPointerError(pointer, `object has no key "${segment}"`)
    }
    return obj[segment]
  }
  throw new JsonPointerError(
    pointer,
    `cannot descend through non-object/array node at "${segment}"`,
  )
}

function setAt(node: unknown, segment: string, value: unknown, pointer: string): void {
  if (Array.isArray(node)) {
    const idx = parseArrayIndex(segment, pointer)
    if (idx > node.length) {
      throw new JsonPointerError(pointer, `array index ${idx} out of range (length=${node.length})`)
    }
    node[idx] = value
    return
  }
  if (node && typeof node === "object") {
    ;(node as Record<string, unknown>)[segment] = value
    return
  }
  throw new JsonPointerError(pointer, "cannot set on non-object/array node")
}

function parseArrayIndex(segment: string, pointer: string): number {
  if (segment === "-") {
    throw new JsonPointerError(pointer, "RFC 6901 '-' (append) is not supported")
  }
  if (!/^\d+$/.test(segment)) {
    throw new JsonPointerError(pointer, `invalid array index "${segment}"`)
  }
  return Number.parseInt(segment, 10)
}

export const CONTENT_ROOT_NODE_KIND = "root"
export const CONTENT_ROOT_NODE_KEY = "root"

export interface ContentOverlay {
  field_path: string
  value: unknown
  node_kind?: string
  node_key?: string
  id?: string
  version?: number
}

export interface MergeOverlaysOptions {
  validate?: (payload: unknown) => { valid: boolean; reason?: string }
  onOverlayError?: (event: { overlay: ContentOverlay; reason: string }) => void
  resolveNodePointer?: (payload: unknown, overlay: ContentOverlay) => string | null
}

export function mergeOverlaysIntoContent(
  payload: unknown,
  overlays: ReadonlyArray<ContentOverlay>,
  options: MergeOverlaysOptions = {},
): unknown {
  let merged = deepClone(payload)
  for (const overlay of overlays) {
    const before = deepClone(merged)
    try {
      const pointer = resolveOverlayPointer(merged, overlay, options)
      if (!pointer) {
        options.onOverlayError?.({
          overlay,
          reason: `node ${overlay.node_kind ?? CONTENT_ROOT_NODE_KIND}/${
            overlay.node_key ?? CONTENT_ROOT_NODE_KEY
          } is not present in the content payload`,
        })
        continue
      }
      merged = applyJsonPointerOverlay(merged, pointer, overlay.value)
    } catch (err) {
      options.onOverlayError?.({
        overlay,
        reason: err instanceof Error ? err.message : String(err),
      })
      merged = before
      continue
    }
    if (options.validate) {
      const result = options.validate(merged)
      if (!result.valid) {
        options.onOverlayError?.({
          overlay,
          reason: result.reason ?? "validator rejected merged payload",
        })
        merged = before
      }
    }
  }
  return merged
}

function resolveOverlayPointer(
  payload: unknown,
  overlay: ContentOverlay,
  options: MergeOverlaysOptions,
): string | null {
  const nodeKind = overlay.node_kind ?? CONTENT_ROOT_NODE_KIND
  const nodeKey = overlay.node_key ?? CONTENT_ROOT_NODE_KEY
  if (nodeKind === CONTENT_ROOT_NODE_KIND && nodeKey === CONTENT_ROOT_NODE_KEY) {
    return options.resolveNodePointer?.(payload, overlay) ?? overlay.field_path
  }
  return options.resolveNodePointer?.(payload, overlay) ?? null
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

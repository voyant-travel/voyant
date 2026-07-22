/**
 * Product editorial-overlay field policy and target addressing.
 *
 * The overlayable surface for sourced products is declared here once so the
 * write path (eligibility enforcement) and the admin read path (field
 * enumeration for the compare editor) cannot drift apart. Only merchandisable
 * presentation fields appear; identifiers, pricing, availability, and other
 * booking-semantic paths are deliberately absent.
 *
 * See `docs/architecture/catalog-architecture.md` §5.2 and RFC #3666.
 */

import {
  OVERLAY_ROOT_NODE_KEY,
  OVERLAY_ROOT_NODE_KIND,
} from "@voyant-travel/catalog/overlay/schema"

import { type ProductContent, productContentFieldToPointer } from "./content-shape.js"

export type ProductEditorialNodeKind = typeof OVERLAY_ROOT_NODE_KIND | "itinerary-day"

/**
 * How an eligible field should be authored. The admin editor picks its control
 * from this; the value shape is enforced by the content schema on write.
 */
export type ProductEditorialFieldKind = "text" | "long-text" | "html" | "string-list" | "media"

export interface ProductEditorialOverlayTarget {
  node_kind?: ProductEditorialNodeKind
  node_key?: string
  field_path: string
}

/** Root-node presentation fields, keyed by their canonical JSON pointer. */
export const ROOT_FIELD_KINDS: ReadonlyMap<string, ProductEditorialFieldKind> = new Map([
  ["/product/name", "text"],
  ["/product/description", "long-text"],
  ["/product/inclusions_html", "html"],
  ["/product/exclusions_html", "html"],
  ["/product/terms_html", "html"],
  ["/product/highlights", "string-list"],
  ["/product/hero_image_url", "media"],
  ["/media", "media"],
])

/** Itinerary-day presentation fields, keyed by their day-relative field name. */
export const DAY_FIELD_KINDS: ReadonlyMap<string, ProductEditorialFieldKind> = new Map([
  ["title", "text"],
  ["description", "long-text"],
  ["hero_image_url", "media"],
  ["services", "string-list"],
])

export const ROOT_FIELDS = new Set(ROOT_FIELD_KINDS.keys())
export const DAY_FIELDS = new Set(DAY_FIELD_KINDS.keys())

export function normalizeTarget(
  target: ProductEditorialOverlayTarget,
): Required<ProductEditorialOverlayTarget> {
  const nodeKind = target.node_kind ?? OVERLAY_ROOT_NODE_KIND
  const nodeKey = normalizeNonEmpty(target.node_key ?? OVERLAY_ROOT_NODE_KEY, "node_key")
  const fieldPath = normalizeNonEmpty(target.field_path, "field_path")
  return {
    node_kind: nodeKind,
    node_key: nodeKey,
    field_path: normalizeFieldPath({ ...target, field_path: fieldPath }),
  }
}

export function normalizeFieldPath(target: ProductEditorialOverlayTarget): string {
  const nodeKind = target.node_kind ?? OVERLAY_ROOT_NODE_KIND
  if (nodeKind === OVERLAY_ROOT_NODE_KIND) {
    return productContentFieldToPointer(target.field_path) ?? target.field_path
  }
  return target.field_path.startsWith("/") ? target.field_path.slice(1) : target.field_path
}

export function normalizeNonEmpty(value: string | undefined, field: string): string {
  const trimmed = value?.trim()
  if (!trimmed) throw new Error(`${field} must be nonempty`)
  return trimmed
}

export function toProductEditorialNodeKind(value?: string): ProductEditorialNodeKind | undefined {
  if (!value || value === OVERLAY_ROOT_NODE_KIND) return OVERLAY_ROOT_NODE_KIND
  if (value === "itinerary-day") return value
  return undefined
}

/** Stable key identifying one overlay target within a locale scope. */
export function targetKey(
  nodeKind = OVERLAY_ROOT_NODE_KIND,
  nodeKey = OVERLAY_ROOT_NODE_KEY,
  path: string,
): string {
  return `${nodeKind}:${nodeKey}:${path}`
}

export function fieldKindFor(
  nodeKind: ProductEditorialNodeKind,
  fieldPath: string,
): ProductEditorialFieldKind | undefined {
  return nodeKind === OVERLAY_ROOT_NODE_KIND
    ? ROOT_FIELD_KINDS.get(fieldPath)
    : DAY_FIELD_KINDS.get(fieldPath)
}

/** Read the current value a target addresses inside a resolved content payload. */
export function readProductTargetValue(
  content: ProductContent,
  overlay: { node_kind?: string; node_key?: string; field_path: string },
): unknown {
  const nodeKind = toProductEditorialNodeKind(overlay.node_kind)
  if (!nodeKind) return undefined
  const normalized = normalizeTarget({ ...overlay, node_kind: nodeKind })
  if (normalized.node_kind === "itinerary-day") {
    const day = content.days.find((candidate) => candidate.id === normalized.node_key)
    return day ? (day as Record<string, unknown>)[normalized.field_path] : undefined
  }
  return readPointer(content, normalized.field_path)
}

export function readPointer(value: unknown, pointer: string): unknown {
  if (!pointer.startsWith("/")) return undefined
  let cursor = value
  for (const raw of pointer.slice(1).split("/")) {
    const segment = raw.replaceAll("~1", "/").replaceAll("~0", "~")
    if (Array.isArray(cursor)) {
      cursor = cursor[Number.parseInt(segment, 10)]
    } else if (cursor && typeof cursor === "object") {
      cursor = (cursor as Record<string, unknown>)[segment]
    } else {
      return undefined
    }
  }
  return cursor
}

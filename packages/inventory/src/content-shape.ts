import {
  CONTENT_ROOT_NODE_KEY,
  CONTENT_ROOT_NODE_KIND,
  type ContentOverlay,
  type MergeOverlaysOptions,
  mergeOverlaysIntoContent,
} from "@voyant-travel/catalog"
import {
  type ProductContent,
  productContentSchema,
  validateProductContent,
} from "@voyant-travel/products-contracts/content-shape"

export {
  BOARD_BASIS_FROM_SHORT_CODE,
  BOARD_BASIS_SHORT_CODES,
  BOARD_BASIS_VALUES,
  type BoardBasis,
  type BoardBasisShortCode,
  boardBasisSchema,
  PRODUCTS_CONTENT_SCHEMA_VERSION,
  type ProductContent,
  type ProductDay,
  type ProductDeparture,
  type ProductMediaItem,
  type ProductOption,
  type ProductPolicy,
  type ProductSummary,
  productContentSchema,
  productDaySchema,
  productDepartureSchema,
  productMediaItemSchema,
  productOptionSchema,
  productOptionUnitSchema,
  productPolicySchema,
  productSummarySchema,
  validateProductContent,
} from "@voyant-travel/products-contracts/content-shape"

/**
 * Apply a list of editorial overlays to a product content payload via
 * RFC 6901 JSON pointers. Validates the merged result against the
 * vertical's Zod schema; overlays that produce an invalid payload are
 * rolled back and reported via `onOverlayError`.
 *
 * Per sourced-content §3.5.4, this is the "content-shape-aware merger"
 * — the catalog plane stays neutral about the content shape; the
 * vertical plugs in its validator here.
 */
export function mergeOverlaysIntoProductContent(
  payload: ProductContent,
  overlays: ReadonlyArray<ContentOverlay>,
  options: Pick<MergeOverlaysOptions, "onOverlayError"> = {},
): ProductContent {
  const merged = mergeOverlaysIntoContent(payload, overlays, {
    resolveNodePointer(p, overlay) {
      return resolveProductOverlayPointer(p as ProductContent, overlay)
    },
    validate(p) {
      const result = validateProductContent(p)
      if (result.valid) {
        return { valid: true }
      }
      return { valid: false, reason: result.reason }
    },
    onOverlayError: options.onOverlayError,
  })
  // The validator gates merges, so a successful merge always parses —
  // re-parse here to satisfy the return type without an unsafe cast.
  return productContentSchema.parse(merged)
}

export function productContentFieldToPointer(fieldPath: string): string | null {
  if (fieldPath.startsWith("/")) return fieldPath
  switch (fieldPath) {
    case "name":
      return "/product/name"
    case "description":
      return "/product/description"
    case "inclusionsHtml":
    case "inclusions_html":
      return "/product/inclusions_html"
    case "exclusionsHtml":
    case "exclusions_html":
      return "/product/exclusions_html"
    case "termsHtml":
    case "terms_html":
      return "/product/terms_html"
    case "primaryMediaUrl":
    case "coverMediaUrl":
    case "hero_image_url":
      return "/product/hero_image_url"
    case "tags[]":
    case "tags":
      return "/product/tags"
    default:
      return null
  }
}

export function normalizeProductContentOverlay(overlay: ContentOverlay): ContentOverlay {
  const nodeKind = overlay.node_kind ?? CONTENT_ROOT_NODE_KIND
  const nodeKey = overlay.node_key ?? CONTENT_ROOT_NODE_KEY
  if (nodeKind !== CONTENT_ROOT_NODE_KIND || nodeKey !== CONTENT_ROOT_NODE_KEY) return overlay
  const pointer = productContentFieldToPointer(overlay.field_path)
  return pointer ? { ...overlay, field_path: pointer } : overlay
}

function resolveProductOverlayPointer(
  payload: ProductContent,
  overlay: ContentOverlay,
): string | null {
  const nodeKind = overlay.node_kind ?? CONTENT_ROOT_NODE_KIND
  const nodeKey = overlay.node_key ?? CONTENT_ROOT_NODE_KEY
  if (nodeKind === CONTENT_ROOT_NODE_KIND && nodeKey === CONTENT_ROOT_NODE_KEY) {
    return productContentFieldToPointer(overlay.field_path) ?? overlay.field_path
  }
  if (nodeKind === "itinerary-day") {
    const index = payload.days.findIndex((day) => day.id === nodeKey)
    if (index < 0) return null
    const field = overlay.field_path.startsWith("/")
      ? overlay.field_path.slice(1)
      : overlay.field_path
    if (!["title", "description", "hero_image_url", "services"].includes(field)) return null
    return `/days/${index}/${field}`
  }
  return null
}

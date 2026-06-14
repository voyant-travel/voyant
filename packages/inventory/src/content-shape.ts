import {
  type ContentOverlay,
  type MergeOverlaysOptions,
  mergeOverlaysIntoContent,
} from "@voyantjs/catalog"
import {
  type ProductContent,
  productContentSchema,
  validateProductContent,
} from "@voyantjs/products-contracts/content-shape"

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
} from "@voyantjs/products-contracts/content-shape"

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

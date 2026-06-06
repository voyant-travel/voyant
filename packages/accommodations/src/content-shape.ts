import {
  type AccommodationContent,
  accommodationContentSchema,
  validateAccommodationContent,
} from "@voyantjs/accommodations-contracts/content-shape"
import {
  type ContentOverlay,
  type MergeOverlaysOptions,
  mergeOverlaysIntoContent,
} from "@voyantjs/catalog"

export {
  ACCOMMODATION_CONTENT_SCHEMA_VERSION,
  type AccommodationAmenity,
  type AccommodationContent,
  type AccommodationMealPlan,
  type AccommodationPolicy,
  type AccommodationRatePlan,
  type AccommodationRoomType,
  accommodationAmenitySchema,
  accommodationContentSchema,
  accommodationMealPlanSchema,
  accommodationPolicySchema,
  accommodationRatePlanSchema,
  accommodationRoomTypeSchema,
  BOARD_BASIS_FROM_SHORT_CODE,
  BOARD_BASIS_SHORT_CODES,
  BOARD_BASIS_VALUES,
  type BoardBasis,
  type BoardBasisShortCode,
  boardBasisSchema,
  type HotelSummary,
  hotelSummarySchema,
  validateAccommodationContent,
} from "@voyantjs/accommodations-contracts/content-shape"

export function mergeOverlaysIntoAccommodationContent(
  payload: AccommodationContent,
  overlays: ReadonlyArray<ContentOverlay>,
  options: Pick<MergeOverlaysOptions, "onOverlayError"> = {},
): AccommodationContent {
  const merged = mergeOverlaysIntoContent(payload, overlays, {
    validate(p) {
      const r = validateAccommodationContent(p)
      return r.valid ? { valid: true } : { valid: false, reason: r.reason }
    },
    onOverlayError: options.onOverlayError,
  })
  return accommodationContentSchema.parse(merged)
}

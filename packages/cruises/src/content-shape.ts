import {
  type ContentOverlay,
  type MergeOverlaysOptions,
  mergeOverlaysIntoContent,
} from "@voyantjs/catalog"
import {
  type CruiseContent,
  cruiseContentSchema,
  validateCruiseContent,
} from "@voyantjs/cruises-contracts/content-shape"

export {
  CRUISES_CONTENT_SCHEMA_VERSION,
  type CruiseCabinCategory,
  type CruiseContent,
  type CruiseItineraryStop,
  type CruisePolicy,
  type CruiseSailing,
  type CruiseShip,
  type CruiseSummary,
  cruiseCabinCategorySchema,
  cruiseContentSchema,
  cruiseItineraryStopSchema,
  cruisePolicySchema,
  cruiseSailingSchema,
  cruiseShipSchema,
  cruiseSummarySchema,
  validateCruiseContent,
} from "@voyantjs/cruises-contracts/content-shape"

export function mergeOverlaysIntoCruiseContent(
  payload: CruiseContent,
  overlays: ReadonlyArray<ContentOverlay>,
  options: Pick<MergeOverlaysOptions, "onOverlayError"> = {},
): CruiseContent {
  const merged = mergeOverlaysIntoContent(payload, overlays, {
    validate(p) {
      const r = validateCruiseContent(p)
      return r.valid ? { valid: true } : { valid: false, reason: r.reason }
    },
    onOverlayError: options.onOverlayError,
  })
  return cruiseContentSchema.parse(merged)
}

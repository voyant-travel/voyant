import {
  type ContentOverlay,
  type MergeOverlaysOptions,
  mergeOverlaysIntoContent,
} from "@voyantjs/catalog"
import {
  type CharterContent,
  charterContentSchema,
  validateCharterContent,
} from "@voyantjs/charters-contracts/content-shape"

export {
  CHARTERS_CONTENT_SCHEMA_VERSION,
  type CharterContent,
  type CharterPolicy,
  type CharterScheduleDay,
  type CharterSuiteContent,
  type CharterSummary,
  type CharterVoyageContent,
  type CharterYachtContent,
  charterContentSchema,
  charterPolicySchema,
  charterScheduleDaySchema,
  charterSuiteSchema,
  charterSummarySchema,
  charterVoyageSchema,
  charterYachtSchema,
  validateCharterContent,
} from "@voyantjs/charters-contracts/content-shape"

export function mergeOverlaysIntoCharterContent(
  payload: CharterContent,
  overlays: ReadonlyArray<ContentOverlay>,
  options: Pick<MergeOverlaysOptions, "onOverlayError"> = {},
): CharterContent {
  const merged = mergeOverlaysIntoContent(payload, overlays, {
    validate(p) {
      const r = validateCharterContent(p)
      return r.valid ? { valid: true } : { valid: false, reason: r.reason }
    },
    onOverlayError: options.onOverlayError,
  })
  return charterContentSchema.parse(merged)
}

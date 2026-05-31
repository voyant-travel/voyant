import {
  type ContentOverlay,
  type MergeOverlaysOptions,
  mergeOverlaysIntoContent,
} from "@voyantjs/catalog"
import {
  type ExtraContent,
  extraContentSchema,
  validateExtraContent,
} from "@voyantjs/extras-contracts/content-shape"

export {
  EXTRAS_CONTENT_SCHEMA_VERSION,
  type ExtraContent,
  type ExtraMediaItem,
  type ExtraOption,
  type ExtraPolicy,
  type ExtraSummary,
  extraContentSchema,
  extraMediaItemSchema,
  extraOptionSchema,
  extraPolicySchema,
  extraSummarySchema,
  validateExtraContent,
} from "@voyantjs/extras-contracts/content-shape"

export function mergeOverlaysIntoExtraContent(
  payload: ExtraContent,
  overlays: ReadonlyArray<ContentOverlay>,
  options: Pick<MergeOverlaysOptions, "onOverlayError"> = {},
): ExtraContent {
  const merged = mergeOverlaysIntoContent(payload, overlays, {
    validate(p) {
      const r = validateExtraContent(p)
      return r.valid ? { valid: true } : { valid: false, reason: r.reason }
    },
    onOverlayError: options.onOverlayError,
  })
  return extraContentSchema.parse(merged)
}

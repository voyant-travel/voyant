/**
 * Helpers for `bookings.internal_notes` — the column doubles as a
 * relay channel for short-lived structured data alongside the
 * operator's free-text notes. We stash machine-readable markers
 * with a `__name__:` prefix so subscribers can look them up before
 * the canonical home (e.g. a contract signature row, a payment
 * schedule history row) materializes.
 *
 * Markers in use today:
 *   - `__contract_acceptance__:` — written by checkout-start, read
 *     by `persistAcceptanceSignature` after the auto-generated
 *     contract is signed. Cleaned up post-sign.
 *   - `__payment_policy_source__:` — written by the booking-schedule
 *     subscriber on every regenerate, read by the contract template
 *     variables resolver. Stays for the contract render.
 *
 * Operators don't read these, so the UI strips them on display. On
 * save through the booking edit dialog, the markers are preserved
 * by re-attaching whatever was in the original row's notes — that
 * way a stale view doesn't accidentally drop a marker the server
 * relies on.
 */

const MARKER_PREFIX_PATTERN = /^__[a-z0-9_]+__:/i

/**
 * Split `notes` into `{ visible, markers }`:
 *   - `visible` — only the lines an operator should see (no markers)
 *   - `markers` — raw marker lines, joined by `\n`, ready to re-attach
 *
 * Lines order is preserved within each group; trailing whitespace and
 * collapsed blank-line groups are tidied so the visible part reads
 * naturally even when markers used to live between paragraphs.
 */
export function splitInternalNotes(notes: string | null | undefined): {
  visible: string
  markers: string
} {
  if (!notes) return { visible: "", markers: "" }
  const visibleLines: string[] = []
  const markerLines: string[] = []
  for (const line of notes.split("\n")) {
    if (MARKER_PREFIX_PATTERN.test(line)) {
      markerLines.push(line)
    } else {
      visibleLines.push(line)
    }
  }
  const visible = visibleLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  const markers = markerLines.join("\n")
  return { visible, markers }
}

/**
 * Convenience for read-only display — the visible portion of the
 * notes with markers stripped. Returns null when nothing remains so
 * callers can hide the section entirely.
 */
export function visibleInternalNotes(notes: string | null | undefined): string | null {
  const { visible } = splitInternalNotes(notes)
  return visible.length > 0 ? visible : null
}

/**
 * Compose a saveable `internal_notes` value from the operator's
 * (possibly edited) free-text plus the markers extracted from the
 * row's prior value. Order: visible part first, then markers, with
 * a blank line in between when both are non-empty so they read as
 * distinct sections in the rare case someone inspects the raw row
 * via SQL.
 */
export function mergeInternalNotes(
  newVisible: string | null | undefined,
  preservedMarkers: string,
): string | null {
  const visible = (newVisible ?? "").trim()
  if (!visible && !preservedMarkers) return null
  if (!preservedMarkers) return visible
  if (!visible) return preservedMarkers
  return `${visible}\n\n${preservedMarkers}`
}

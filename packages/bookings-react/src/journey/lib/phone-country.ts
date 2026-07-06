/**
 * Resolve the default country for the journey's phone inputs, as an ISO
 * 3166-1 alpha-2 code (uppercased). Resolution order:
 *
 *   1. an explicit caller-supplied code (`defaultPhoneCountry`), when it is a
 *      usable 2-letter region;
 *   2. the region of the active i18n locale — e.g. "ro-RO" → "RO", "en-US" →
 *      "US"; bare language tags are maximized so "ro" → "RO";
 *   3. "GB" as a last resort when neither yields a usable region.
 *
 * Kept internal (not on the package's public export map) — exported only so the
 * unit tests can exercise the resolution rules directly.
 */
export function resolveDefaultPhoneCountry(
  explicit: string | undefined,
  locale: string | null | undefined,
): string {
  return normalizeRegion(explicit) ?? regionFromLocale(locale) ?? "GB"
}

/** Uppercase + validate a candidate region; `null` when it isn't two letters. */
function normalizeRegion(value: string | null | undefined): string | null {
  if (!value) return null
  const upper = value.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(upper) ? upper : null
}

/**
 * Derive a region from a locale string. `Intl.Locale` parses the tag; when it
 * carries no explicit region (a bare language like "ro"), `.maximize()` fills
 * in the likely one ("ro" → "ro-Latn-RO"). Locale strings can be garbage, so
 * any parse failure falls through to `null`.
 */
function regionFromLocale(locale: string | null | undefined): string | null {
  if (!locale) return null
  try {
    const parsed = new Intl.Locale(locale)
    return normalizeRegion(parsed.region ?? parsed.maximize().region)
  } catch {
    return null
  }
}

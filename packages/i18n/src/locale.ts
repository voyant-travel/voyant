const DEFAULT_LOCALE = "en"

export function canonicalizeLocale(
  locale: string | null | undefined,
  fallbackLocale = DEFAULT_LOCALE,
): string {
  const candidate = (locale ?? "").trim().replaceAll("_", "-")
  if (candidate) {
    try {
      return Intl.getCanonicalLocales(candidate)[0] ?? fallbackLocale
    } catch {
      // Fall through to the configured fallback.
    }
  }

  const fallback = fallbackLocale.trim().replaceAll("_", "-") || DEFAULT_LOCALE
  try {
    return Intl.getCanonicalLocales(fallback)[0] ?? DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

/** Locale layers from the broadest language match to the exact requested tag. */
export function localeHierarchy(locale: string | null | undefined): string[] {
  const canonical = canonicalizeLocale(locale)

  try {
    const parsed = new Intl.Locale(canonical)
    const candidates = [parsed.language]
    if (parsed.script) candidates.push(`${parsed.language}-${parsed.script}`)
    candidates.push(canonical)
    return [...new Set(candidates)]
  } catch {
    return [canonical]
  }
}

export function canonicalizeTimeZone(timeZone: string | null | undefined): string | null {
  const candidate = (timeZone ?? "").trim()
  if (!candidate) return null

  try {
    return new Intl.DateTimeFormat("en", { timeZone: candidate }).resolvedOptions().timeZone
  } catch {
    return null
  }
}

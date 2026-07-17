/**
 * Deterministic app-locale resolution for the extension host (RFC §6.1).
 *
 * The host always passes the staff member's active locale to the frame. It also
 * resolves an "app locale" against the installed release's declared locales so
 * host-rendered labels (nav entries, extension titles) and the frame's initial
 * direction are chosen consistently:
 *
 *   1. exact active-locale match;
 *   2. progressively less specific language match (`pt-BR` → `pt`);
 *   3. the app's declared default locale.
 *
 * Everything here is pure and BCP 47 aware only to the extent of splitting on
 * the primary subtag — the app remains authoritative for its in-frame
 * translations and may choose a more sophisticated fallback itself.
 */

export type AppTextDirection = "ltr" | "rtl"

/**
 * Primary language subtags written right-to-left. Kept small and explicit; the
 * frame receives the resolved direction so it never has to infer it from an
 * incomplete language list.
 */
const RTL_LANGUAGES = new Set([
  "ar", // Arabic
  "arc", // Aramaic
  "ckb", // Central Kurdish (Sorani)
  "dv", // Divehi
  "fa", // Persian
  "he", // Hebrew
  "ku", // Kurdish
  "ps", // Pashto
  "sd", // Sindhi
  "syr", // Syriac
  "ur", // Urdu
  "yi", // Yiddish
])

/** The primary language subtag of a BCP 47 tag, lowercased. */
function primaryLanguage(locale: string): string {
  return locale.trim().toLowerCase().split(/[-_]/)[0] ?? ""
}

/** Text direction for a locale, from its primary language subtag. */
export function resolveTextDirection(locale: string): AppTextDirection {
  return RTL_LANGUAGES.has(primaryLanguage(locale)) ? "rtl" : "ltr"
}

export interface AppLocaleDeclaration {
  defaultLocale: string
  supportedLocales: readonly string[]
}

export interface ResolvedAppLocale {
  /** The active admin locale the host requested resolution for. */
  requestedLocale: string
  /** The declared locale the host resolved to (exact → language → default). */
  appLocale: string
  /** Text direction for {@link appLocale}. */
  direction: AppTextDirection
}

/**
 * Resolve the app locale for an active admin locale against a release's
 * declared locales. The returned `appLocale` is always one of the declared
 * tags (falling back to `defaultLocale`), preserving the declared casing.
 */
export function resolveAppLocale(
  activeLocale: string,
  declaration: AppLocaleDeclaration,
): ResolvedAppLocale {
  const requested = activeLocale.trim()
  const normalized = requested.toLowerCase()
  const supported = declaration.supportedLocales

  const exact = supported.find((candidate) => candidate.toLowerCase() === normalized)
  if (exact) {
    return { requestedLocale: requested, appLocale: exact, direction: resolveTextDirection(exact) }
  }

  const requestedLanguage = primaryLanguage(requested)
  if (requestedLanguage) {
    const languageMatch = supported.find(
      (candidate) => primaryLanguage(candidate) === requestedLanguage,
    )
    if (languageMatch) {
      return {
        requestedLocale: requested,
        appLocale: languageMatch,
        direction: resolveTextDirection(languageMatch),
      }
    }
  }

  return {
    requestedLocale: requested,
    appLocale: declaration.defaultLocale,
    direction: resolveTextDirection(declaration.defaultLocale),
  }
}

/** One flattened host-rendered localization row (matches `app_release_localizations`). */
export interface HostLabelRow {
  locale: string
  surface: string
  messageKey: string
  text: string
}

export interface HostLabelResolver {
  /**
   * Resolve a host-rendered label for a message key, trying the resolved app
   * locale first and then the default locale (host labels use the platform
   * algorithm, never the app's in-frame fallback). Returns null when no
   * declared surface carries the key.
   */
  resolve(messageKey: string, surfaces?: readonly string[]): string | null
}

const DEFAULT_LABEL_SURFACES = ["extension", "navigation", "setup", "app"] as const

/**
 * Build a resolver over a release's localization rows for a resolved app locale
 * with default-locale fallback. Missing translations fall back deterministically
 * rather than throwing, so an incomplete non-default locale never blocks mount.
 */
export function createHostLabelResolver(
  rows: readonly HostLabelRow[],
  appLocale: string,
  defaultLocale: string,
): HostLabelResolver {
  // locale → surface → messageKey → text
  const byLocale = new Map<string, Map<string, Map<string, string>>>()
  for (const row of rows) {
    const locale = row.locale.toLowerCase()
    let surfaces = byLocale.get(locale)
    if (!surfaces) {
      surfaces = new Map()
      byLocale.set(locale, surfaces)
    }
    let keys = surfaces.get(row.surface)
    if (!keys) {
      keys = new Map()
      surfaces.set(row.surface, keys)
    }
    keys.set(row.messageKey, row.text)
  }

  const localePreference = [appLocale.toLowerCase(), defaultLocale.toLowerCase()]

  return {
    resolve(messageKey, surfaces = DEFAULT_LABEL_SURFACES) {
      for (const locale of localePreference) {
        const surfaceMap = byLocale.get(locale)
        if (!surfaceMap) continue
        for (const surface of surfaces) {
          const text = surfaceMap.get(surface)?.get(messageKey)
          if (text !== undefined) return text
        }
      }
      return null
    },
  }
}

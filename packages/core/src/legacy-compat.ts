/**
 * Compatibility redirects for superseded deep links, plus the usage counting
 * that turns "is anyone still hitting the old URL?" from an assumption into a
 * fact someone can check.
 *
 * The unified Product / Departure model retired four families of first-party
 * deep link. Rather than break bookmarks, older emails and cached search
 * results during the measured compatibility period, each legacy path resolves
 * to its canonical successor here, and every hit is counted against a stable
 * key. The redirects are **built and instrumented** — they are NOT deleted.
 * Removal is gated on measured-zero usage plus a human release review (see
 * voyant#4038); this module is what makes the "zero" measurable.
 *
 * Nothing in here reads a database or a request body, so it is safe to import
 * from any layer. A route middleware resolves the redirect and records the hit
 * against a `LegacyPathUsageStore`; the operator dashboard reads the store's
 * snapshot back as the `legacy-path usage` metric (no PII — only route keys and
 * counts are ever recorded).
 */

/** The four superseded deep-link families this compatibility layer covers. */
export type LegacyRouteFamily = "extras" | "catalog" | "product" | "availability"

export interface LegacyRedirect {
  /** Stable key the usage counter and the release review track. Never reuse. */
  key: string
  family: LegacyRouteFamily
  /** The canonical path the legacy link now resolves to. */
  to: string
  /**
   * HTTP status for the redirect. `308` (permanent, method-preserving) for a
   * straight rename; superseded surfaces use `308` so proxies and clients cache
   * the successor for the compatibility window.
   */
  status: 301 | 308
}

interface LegacyRedirectRule {
  key: string
  family: LegacyRouteFamily
  /** Matches a legacy pathname, capturing the id segment where present. */
  pattern: RegExp
  /** Builds the canonical path from the regex match. */
  to: (match: RegExpMatchArray) => string
  status: 301 | 308
}

/**
 * The compatibility table. One rule per superseded first-party deep link.
 * Ordered most-specific-first so a nested legacy path never matches a broader
 * rule ahead of its own.
 */
const LEGACY_REDIRECT_RULES: readonly LegacyRedirectRule[] = [
  // Extras were a standalone beta surface; they are Product-owned Options now.
  {
    key: "extras.detail",
    family: "extras",
    pattern: /^\/extras\/([^/]+)\/?$/,
    to: (m) => `/products/options/${m[1]}`,
    status: 308,
  },
  {
    key: "extras.index",
    family: "extras",
    pattern: /^\/extras\/?$/,
    to: () => "/products/options",
    status: 308,
  },
  // The scheduled Catalog browse surface is the Product catalog now.
  {
    key: "catalog.scheduled.detail",
    family: "catalog",
    pattern: /^\/catalog\/scheduled\/([^/]+)\/?$/,
    to: (m) => `/products/${m[1]}`,
    status: 308,
  },
  {
    key: "catalog.scheduled.index",
    family: "catalog",
    pattern: /^\/catalog\/scheduled\/?$/,
    to: () => "/products",
    status: 308,
  },
  // Legacy Product detail path (singular) → the canonical plural resource.
  {
    key: "product.detail",
    family: "product",
    pattern: /^\/product\/([^/]+)\/?$/,
    to: (m) => `/products/${m[1]}`,
    status: 308,
  },
  // Operator Availability deep link → the Departure workspace on the slot.
  {
    key: "availability.slot",
    family: "availability",
    pattern: /^\/availability\/slots\/([^/]+)\/?$/,
    to: (m) => `/operations/departures/${m[1]}`,
    status: 308,
  },
]

/** Every stable redirect key, e.g. for seeding a usage report at zero. */
export const LEGACY_REDIRECT_KEYS: readonly string[] = LEGACY_REDIRECT_RULES.map((r) => r.key)

/**
 * Resolve a legacy pathname to its canonical successor, or `null` when the path
 * is not a superseded one. Query strings and fragments are ignored — pass the
 * pathname only.
 */
export function resolveLegacyRedirect(pathname: string): LegacyRedirect | null {
  for (const rule of LEGACY_REDIRECT_RULES) {
    const match = pathname.match(rule.pattern)
    if (match) {
      return { key: rule.key, family: rule.family, to: rule.to(match), status: rule.status }
    }
  }
  return null
}

/** One row of legacy-path usage. Carries a route key and a count — never PII. */
export interface LegacyPathUsageRow {
  key: string
  family: LegacyRouteFamily
  hits: number
  /** ISO instant of the most recent hit, or null when never hit. */
  lastSeenAt: string | null
}

/**
 * The usage-counting seam. A deployment binds a durable implementation (shared
 * across the fleet) so "usage is zero" is a fleet-wide fact; the in-memory
 * default below is enough for a single process and for tests.
 */
export interface LegacyPathUsageStore {
  record(key: string, at: Date): void | Promise<void>
  snapshot(): LegacyPathUsageRow[] | Promise<LegacyPathUsageRow[]>
}

const FAMILY_BY_KEY = new Map<string, LegacyRouteFamily>(
  LEGACY_REDIRECT_RULES.map((r) => [r.key, r.family]),
)

/**
 * In-memory usage store, seeded so every known key reports even before its
 * first hit — a key absent from the report reads as "no such route", which is
 * not the same as "zero usage". A release review needs the explicit zero.
 */
export class InMemoryLegacyPathUsageStore implements LegacyPathUsageStore {
  private readonly counts = new Map<string, { hits: number; lastSeenAt: string | null }>()

  constructor() {
    for (const key of LEGACY_REDIRECT_KEYS) {
      this.counts.set(key, { hits: 0, lastSeenAt: null })
    }
  }

  record(key: string, at: Date): void {
    const current = this.counts.get(key) ?? { hits: 0, lastSeenAt: null }
    this.counts.set(key, { hits: current.hits + 1, lastSeenAt: at.toISOString() })
  }

  snapshot(): LegacyPathUsageRow[] {
    return [...this.counts.entries()].map(([key, value]) => ({
      key,
      family: FAMILY_BY_KEY.get(key) ?? "product",
      hits: value.hits,
      lastSeenAt: value.lastSeenAt,
    }))
  }
}

export interface LegacyRedirectOutcome {
  redirect: LegacyRedirect
}

/**
 * Resolve a redirect for a pathname AND count the hit in one call, for a route
 * middleware to use. Returns the redirect (so the caller issues the response)
 * or `null` to fall through to normal routing. Recording failures are swallowed
 * — a compatibility redirect must never fail because its counter did.
 */
export async function resolveAndCountLegacyRedirect(
  store: LegacyPathUsageStore,
  pathname: string,
  now: Date,
): Promise<LegacyRedirect | null> {
  const redirect = resolveLegacyRedirect(pathname)
  if (!redirect) return null
  try {
    await store.record(redirect.key, now)
  } catch {
    // Counting is best-effort; never block the redirect on it.
  }
  return redirect
}

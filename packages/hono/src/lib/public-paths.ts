/**
 * Shared `publicPaths` matching semantics.
 *
 * `requireAuth`, the legacy-surface guard, and the default rate-limit
 * policies in `createApp` all need to answer "is this pathname covered
 * by `config.publicPaths`?" with identical prefix-match semantics — a
 * drifted copy of this check is an auth bypass (or a gap), so the
 * matcher lives here and everyone imports it.
 */

/** Strip a single trailing slash so `/v1/x/` and `/v1/x` match alike. */
export function normalizePathname(pathname: string): string {
  return pathname.replace(/\/$/, "")
}

/**
 * Whether `pathname` (pre-normalized via {@link normalizePathname}) is an
 * exact match or a path-segment-prefixed match of any configured public
 * path. `"/v1/public/checkout"` covers `/v1/public/checkout` and
 * `/v1/public/checkout/anything`, but NOT `/v1/public/checkouts`.
 */
export function matchesPublicPath(pathname: string, publicPaths: readonly string[]): boolean {
  for (const publicPath of publicPaths) {
    if (pathname === publicPath || pathname.startsWith(`${publicPath}/`)) {
      return true
    }
  }
  return false
}

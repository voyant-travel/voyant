/**
 * Shared `publicPaths` matching semantics.
 *
 * `requireAuth`, the legacy-surface guard, and the default rate-limit
 * policies in `createApp` all need to answer "is this pathname covered
 * by `config.publicPaths`?" with identical prefix-match semantics — a
 * drifted copy of this check is an auth bypass (or a gap), so the
 * matcher lives here and everyone imports it.
 */

export interface PathnameNormalizationOptions {
  /**
   * Deployment prefix stripped before matching app-local paths. Useful when a
   * Hono app is mounted under a hosting prefix (for example `/api`) and sees
   * the original request URL while its routes/publicPaths are app-relative.
   */
  basePath?: string
}

function normalizeBasePath(basePath: string | undefined): string {
  const trimmed = basePath?.trim()
  if (!trimmed || trimmed === "/") return ""
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`
}

/**
 * Strip a single trailing slash so `/v1/x/` and `/v1/x` match alike. When a
 * deployment base path is configured, strip it first using path-segment
 * semantics so `/api/v1/x` normalizes to `/v1/x`, but `/apiary/v1/x` does not.
 */
export function normalizePathname(
  pathname: string,
  options: PathnameNormalizationOptions = {},
): string {
  const normalized = pathname.replace(/\/$/, "")
  const basePath = normalizeBasePath(options.basePath)
  if (!basePath) return normalized
  if (normalized === basePath) return ""
  if (normalized.startsWith(`${basePath}/`)) {
    return normalized.slice(basePath.length)
  }
  return normalized
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

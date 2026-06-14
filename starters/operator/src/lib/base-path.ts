/**
 * Base path utilities for the dash app.
 *
 * When the app is hosted under a path (e.g., /dash), all client-side
 * fetches to internal API routes need to include this base path.
 *
 * Next.js automatically handles basePath for:
 * - next/link navigation
 * - next/router navigation
 * - next/image src
 *
 * But raw fetch() calls and window.location assignments need manual handling.
 */

/**
 * The base path for the dash app.
 * This should match the basePath in next.config.mjs
 */
export const BASE_PATH = ""

/**
 * Prepend the base path to an internal API route.
 *
 * @example
 * ```ts
 * // Instead of:
 * fetch("/api/auth/status")
 *
 * // Use:
 * fetch(apiRoute("/api/auth/status"))
 * ```
 */
export function apiRoute(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${BASE_PATH}${normalizedPath}`
}

/**
 * Prepend the base path to a navigation URL.
 * Use this for window.location.href assignments and other direct URL manipulations.
 *
 * @example
 * ```ts
 * // Instead of:
 * window.location.href = "/products"
 *
 * // Use:
 * window.location.href = navUrl("/products")
 * ```
 */
export function navUrl(path: string): string {
  // Don't modify external URLs
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path
  }
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${BASE_PATH}${normalizedPath}`
}

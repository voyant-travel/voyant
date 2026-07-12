import { createIsomorphicFn } from "@tanstack/react-start"
import { getRequestHeader, getRequestUrl } from "@tanstack/react-start/server"
import { defaultFetcher, type VoyantFetcher } from "@voyant-travel/react"

export type { VoyantFetcher }

const ADMIN_API_PREFIXES = [
  "/v1/relationships",
  "/v1/operations",
  "/v1/products",
  "/v1/markets",
  "/v1/bookings",
  "/v1/suppliers",
] as const

function rewriteAdminPath(pathname: string): string {
  const apiPrefix = "/api"
  const hasApiPrefix = pathname === apiPrefix || pathname.startsWith(`${apiPrefix}/`)
  const appPath = hasApiPrefix ? pathname.slice(apiPrefix.length) || "/" : pathname

  for (const prefix of ADMIN_API_PREFIXES) {
    if (appPath === prefix || appPath.startsWith(`${prefix}/`)) {
      const rewritten = appPath.replace(prefix, `/v1/admin${prefix.slice("/v1".length)}`)
      return hasApiPrefix ? `${apiPrefix}${rewritten}` : rewritten
    }
  }

  return pathname
}

export function normalizeAdminApiUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const parsed = new URL(url)
    parsed.pathname = rewriteAdminPath(parsed.pathname)
    return parsed.toString()
  }

  if (url.startsWith("/")) {
    const parsed = new URL(url, "http://voyant.local")
    const rewrittenPath = rewriteAdminPath(parsed.pathname)
    return `${rewrittenPath}${parsed.search}${parsed.hash}`
  }

  return url
}

/**
 * API URL helper.
 *
 * API is embedded at /api on the same origin — no cross-origin needed.
 * Returns an absolute URL so Better Auth's `new URL(baseURL)` works during SSR.
 */
export function getAdminApiUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`
  }
  // SSR: fall back to the dev origin. In prod, set DASH_BASE_URL. Read `process`
  // off `globalThis` so this browser-targeted package needs no `node` types (on
  // the client this branch is unreachable — `window` is defined above).
  const ssrEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env
  return `${ssrEnv?.DASH_BASE_URL ?? "http://localhost:3300"}/api`
}

/**
 * Isomorphic Voyant fetcher.
 *
 * On the client: normalizes package-emitted admin paths onto the admin API
 * surface, then sends session cookies via `credentials: "include"`.
 *
 * On the server (route loaders / server functions when SSR is enabled):
 * normalizes package-emitted admin paths, forwards the incoming request's
 * `Cookie` header, and rewrites absolute `getAdminApiUrl()`-style
 * URLs onto the request origin, so the fetch loops back into this Worker and
 * hits the Hono app mounted at `/api/*` in the deployment entry.
 *
 * `createIsomorphicFn` strips the `.server(...)` branch (including its
 * imports) from client bundles, so the `@tanstack/react-start/server`
 * import here doesn't ship to the browser.
 */
const fetcherImpl = createIsomorphicFn()
  .client((url: string, init?: RequestInit) => defaultFetcher(normalizeAdminApiUrl(url), init))
  .server((url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const cookie = getRequestHeader("cookie")
    if (cookie) headers.set("cookie", cookie)

    const origin = getRequestUrl().origin
    const normalizedUrl = normalizeAdminApiUrl(url)
    let target = normalizedUrl
    if (normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://")) {
      const u = new URL(normalizedUrl)
      target = `${origin}${u.pathname}${u.search}${u.hash}`
    }

    return fetch(target, { ...init, headers })
  })

export const adminFetcher: VoyantFetcher = (url, init) =>
  fetcherImpl(url, init) as Promise<Response>

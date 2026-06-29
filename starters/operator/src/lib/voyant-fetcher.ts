import { createIsomorphicFn } from "@tanstack/react-start"
import { getRequestHeader, getRequestUrl } from "@tanstack/react-start/server"
import { defaultFetcher, type VoyantFetcher } from "@voyant-travel/inventory-react"
import { normalizeOperatorAdminApiUrl } from "./operator-admin-api-paths"

/**
 * Isomorphic Voyant fetcher.
 *
 * On the client: normalizes package-emitted operator paths onto the admin API
 * surface, then sends session cookies via `credentials: "include"`.
 *
 * On the server (route loaders / server functions when SSR is enabled):
 * normalizes package-emitted operator paths, forwards the incoming request's
 * `Cookie` header, and rewrites absolute `getApiUrl()`-style URLs onto the
 * request origin, so the fetch loops back into this Worker and hits the Hono
 * app mounted at `/api/*` in `entry.ts`.
 *
 * `createIsomorphicFn` strips the `.server(...)` branch (including its
 * imports) from client bundles, so the `@tanstack/react-start/server`
 * import here doesn't ship to the browser.
 */
const fetcherImpl = createIsomorphicFn()
  .client((url: string, init?: RequestInit) =>
    defaultFetcher(normalizeOperatorAdminApiUrl(url), init),
  )
  .server((url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const cookie = getRequestHeader("cookie")
    if (cookie) headers.set("cookie", cookie)

    const origin = getRequestUrl().origin
    const normalizedUrl = normalizeOperatorAdminApiUrl(url)
    let target = normalizedUrl
    if (normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://")) {
      const u = new URL(normalizedUrl)
      target = `${origin}${u.pathname}${u.search}${u.hash}`
    }

    return fetch(target, { ...init, headers })
  })

export const operatorFetcher: VoyantFetcher = (url, init) =>
  fetcherImpl(url, init) as Promise<Response>

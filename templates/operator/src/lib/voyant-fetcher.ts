import { createIsomorphicFn } from "@tanstack/react-start"
import { getRequestHeader, getRequestUrl } from "@tanstack/react-start/server"
import { defaultFetcher, type VoyantFetcher } from "@voyantjs/inventory-react"

/**
 * Isomorphic Voyant fetcher.
 *
 * On the client: same as `defaultFetcher` — browser sends session cookies via
 * `credentials: "include"`.
 *
 * On the server (route loaders / server functions when SSR is enabled):
 * forwards the incoming request's `Cookie` header and rewrites absolute
 * `getApiUrl()`-style URLs onto the request origin, so the fetch loops back
 * into this Worker and hits the Hono app mounted at `/api/*` in `entry.ts`.
 *
 * `createIsomorphicFn` strips the `.server(...)` branch (including its
 * imports) from client bundles, so the `@tanstack/react-start/server`
 * import here doesn't ship to the browser.
 */
const fetcherImpl = createIsomorphicFn()
  .client((url: string, init?: RequestInit) => defaultFetcher(url, init))
  .server((url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const cookie = getRequestHeader("cookie")
    if (cookie) headers.set("cookie", cookie)

    const origin = getRequestUrl().origin
    let target = url
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const u = new URL(url)
      target = `${origin}${u.pathname}${u.search}${u.hash}`
    }

    return fetch(target, { ...init, headers })
  })

export const operatorFetcher: VoyantFetcher = (url, init) =>
  fetcherImpl(url, init) as Promise<Response>

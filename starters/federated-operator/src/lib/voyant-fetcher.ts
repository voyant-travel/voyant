import { createIsomorphicFn } from "@tanstack/react-start"
import { getRequestHeader, getRequestUrl } from "@tanstack/react-start/server"
import { defaultFetcher, type VoyantFetcher } from "@voyant-travel/react"

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

export const federatedOperatorFetcher: VoyantFetcher = (url, init) =>
  fetcherImpl(url, init) as Promise<Response>

import type { SmartbillFetch } from "../types.js"

export function createGlobalSmartbillFetch(): SmartbillFetch | undefined {
  if (typeof globalThis.fetch !== "function") return undefined
  return (input, init) => globalThis.fetch(input, init)
}

function headersForPluginFetch(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers || Array.isArray(headers)) {
    return Object.fromEntries(new Headers(headers).entries())
  }
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) out[key] = String(value)
  return out
}

export function asResilientFetch(fetchImpl: SmartbillFetch): typeof fetch {
  return async (input, init = {}) => {
    const response = await fetchImpl(input instanceof Request ? input.url : String(input), {
      method: init.method ?? "GET",
      headers: headersForPluginFetch(init.headers),
      ...(typeof init.body === "string" ? { body: init.body } : {}),
    })
    if (response instanceof Response) return response
    const contentType = response.headers?.get("content-type")
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: contentType ? { "content-type": contentType } : undefined,
    })
  }
}

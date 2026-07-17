import { lookup } from "node:dns/promises"
import { request as httpsRequest } from "node:https"
import { isIP, type LookupFunction } from "node:net"

export interface ManifestFetchOptions {
  fetch?: typeof fetch
  maxBytes?: number
  maxRedirects?: number
  timeoutMs?: number
  allowedContentTypes?: readonly string[]
  resolveHost?: (hostname: string) => Promise<readonly string[]>
}

export interface FetchedManifest {
  url: string
  contentType: string
  body: unknown
  bytes: number
}

const DEFAULT_MAX_BYTES = 256 * 1024
const DEFAULT_MAX_REDIRECTS = 3
const DEFAULT_TIMEOUT_MS = 5000
/** Hard transport-level body cap; the caller enforces the tighter manifest cap. */
const TRANSPORT_MAX_BODY_BYTES = 1024 * 1024
const DEFAULT_CONTENT_TYPES = ["application/json", "application/manifest+json"] as const

export async function fetchProtectedManifest(
  inputUrl: string,
  options: ManifestFetchOptions = {},
): Promise<FetchedManifest> {
  const fetcher = options.fetch ?? createPinnedFetch(options.resolveHost)
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS
  const allowedContentTypes = options.allowedContentTypes ?? DEFAULT_CONTENT_TYPES
  let current = requireHttpsUrl(inputUrl)

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertPublicHostname(current, options.resolveHost)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    try {
      const response = await fetcher(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: "application/json, application/manifest+json" },
      })
      if (isRedirect(response.status)) {
        if (redirectCount === maxRedirects) {
          throw new Error("Manifest fetch exceeded the maximum redirect count.")
        }
        const location = response.headers.get("location")
        if (!location) throw new Error("Manifest redirect did not include a Location header.")
        current = requireHttpsUrl(new URL(location, current).toString())
        continue
      }
      if (!response.ok) {
        throw new Error(`Manifest fetch failed with HTTP ${response.status}.`)
      }
      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? ""
      if (!allowedContentTypes.includes(contentType)) {
        throw new Error(`Manifest response content-type "${contentType}" is not allowed.`)
      }
      const text = await readBoundedResponse(response, maxBytes)
      return {
        url: current,
        contentType,
        bytes: new TextEncoder().encode(text).byteLength,
        body: JSON.parse(text),
      }
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error("Manifest response was not valid JSON.")
      if ((error as { name?: string }).name === "AbortError") {
        throw new Error("Manifest fetch timed out.")
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error("Manifest fetch failed.")
}

async function readBoundedResponse(response: Response, maxBytes: number): Promise<string> {
  const contentLength = response.headers.get("content-length")
  if (contentLength) {
    const size = Number(contentLength)
    if (Number.isFinite(size) && size > maxBytes) {
      throw new Error("Manifest response exceeded the maximum allowed size.")
    }
  }
  const reader = response.body?.getReader()
  if (!reader) return response.text()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > maxBytes) throw new Error("Manifest response exceeded the maximum allowed size.")
      chunks.push(value)
    }
  }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}

function requireHttpsUrl(value: string): string {
  const url = new URL(value)
  if (url.protocol !== "https:") throw new Error("Manifest URL must use HTTPS.")
  if (url.username || url.password) throw new Error("Manifest URL must not include credentials.")
  return url.toString()
}

async function assertPublicHostname(
  value: string,
  resolveHost: ManifestFetchOptions["resolveHost"] = defaultResolveHost,
) {
  const url = new URL(value)
  if (isPrivateHostname(url.hostname)) {
    throw new Error("Manifest URL host is not publicly routable.")
  }
  const addresses = await resolveHost(url.hostname)
  if (addresses.length === 0) throw new Error("Manifest URL host did not resolve.")
  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      throw new Error("Manifest URL resolved to a private or reserved address.")
    }
  }
}

async function defaultResolveHost(hostname: string): Promise<string[]> {
  const result = await lookup(hostname, { all: true, verbatim: true })
  return result.map((entry: { address: string }) => entry.address)
}

/**
 * A fetch-compatible transport whose socket connects only to addresses that
 * were validated inside the same DNS resolution. `assertPublicHostname` alone
 * is a time-of-check/time-of-use guard: a publisher-controlled name can
 * rebind between the check and the connect. Pinning validation into the
 * connection `lookup` closes that window.
 */
function createPinnedFetch(resolveHost: ManifestFetchOptions["resolveHost"]): typeof fetch {
  const pinnedLookup: LookupFunction = (hostname, lookupOptions, callback) => {
    const resolve = async () => {
      const addresses = resolveHost
        ? (await resolveHost(hostname)).map((address) => ({
            address,
            family: isIP(address) === 6 ? 6 : 4,
          }))
        : await lookup(hostname, { all: true, verbatim: true })
      if (addresses.length === 0) {
        throw new Error("Manifest URL host did not resolve.")
      }
      for (const entry of addresses) {
        if (isPrivateAddress(entry.address)) {
          throw new Error("Manifest URL resolved to a private or reserved address.")
        }
      }
      return addresses
    }
    resolve().then(
      (addresses) => {
        if (lookupOptions.all) {
          callback(null, addresses)
          return
        }
        const first = addresses[0] as { address: string; family: number }
        callback(null, first.address, first.family)
      },
      (error) => callback(error as NodeJS.ErrnoException, "", 4),
    )
  }

  return (input, init) =>
    new Promise<Response>((resolvePromise, rejectPromise) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      )
      const headers: Record<string, string> = {}
      if (init?.headers && !Array.isArray(init.headers) && !(init.headers instanceof Headers)) {
        Object.assign(headers, init.headers)
      }
      const request = httpsRequest(
        {
          host: url.hostname,
          port: url.port === "" ? 443 : Number(url.port),
          path: `${url.pathname}${url.search}`,
          method: init?.method ?? "GET",
          headers,
          signal: init?.signal ?? undefined,
          lookup: pinnedLookup,
        },
        (incoming) => {
          const status = incoming.statusCode ?? 0
          const responseHeaders = new Headers()
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (typeof value === "string") responseHeaders.set(name, value)
            else if (Array.isArray(value)) responseHeaders.set(name, value.join(", "))
          }
          const chunks: Buffer[] = []
          let received = 0
          incoming.on("data", (chunk: Buffer) => {
            received += chunk.byteLength
            if (received > TRANSPORT_MAX_BODY_BYTES) {
              incoming.destroy()
              rejectPromise(new Error("Manifest response exceeded the maximum allowed size."))
              return
            }
            chunks.push(chunk)
          })
          incoming.on("end", () => {
            const body =
              status === 204 || status === 304 ? null : new Uint8Array(Buffer.concat(chunks))
            resolvePromise(new Response(body, { status, headers: responseHeaders }))
          })
          incoming.on("error", rejectPromise)
        },
      )
      request.on("error", rejectPromise)
      request.end()
    })
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400
}

function isPrivateHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  )
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 0) return true
  if (address === "::1" || address === "0:0:0:0:0:0:0:1") return true
  if (address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) {
    return true
  }
  const parts = address.split(".").map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false
  const first = parts[0] as number
  const second = parts[1] as number
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  )
}

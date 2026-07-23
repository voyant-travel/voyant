import { lookup } from "node:dns/promises"
import { request as httpsRequest } from "node:https"
import { isIP, type LookupFunction } from "node:net"

import { assertOutboundWebhookEndpointUrl } from "./security.js"

export type WebhookHostResolver = (hostname: string) => Promise<readonly string[]>

const TRANSPORT_MAX_BODY_BYTES = 64 * 1024

export class UnsafeWebhookEndpointError extends Error {
  constructor(message = "Webhook endpoint is not allowed.") {
    super(message)
    this.name = "UnsafeWebhookEndpointError"
  }
}

export async function assertPublicWebhookEndpoint(
  value: string,
  resolveHost: WebhookHostResolver,
): Promise<void> {
  assertOutboundWebhookEndpointUrl(value)
  const hostname = new URL(value).hostname
  const addresses = await resolveHost(hostname)
  if (addresses.length === 0) {
    throw new UnsafeWebhookEndpointError("Webhook endpoint host did not resolve.")
  }
  for (const address of addresses) {
    if (isPrivateOrReservedAddress(address)) {
      throw new UnsafeWebhookEndpointError()
    }
  }
}

export async function resolveWebhookHost(hostname: string): Promise<string[]> {
  const result = await lookup(hostname, { all: true, verbatim: true })
  return result.map((entry: { address: string }) => entry.address)
}

/**
 * HTTPS transport whose socket lookup applies the same public-address policy as
 * admission. This closes the DNS-rebinding window between validation and
 * connect; redirects remain the caller's responsibility and must be manual.
 */
export function createPinnedWebhookFetch(
  resolveHost: WebhookHostResolver = resolveWebhookHost,
): typeof fetch {
  const pinnedLookup: LookupFunction = (hostname, lookupOptions, callback) => {
    resolveHost(hostname).then(
      (values) => {
        const addresses = values.map((address) => ({
          address,
          family: isIP(address) === 6 ? 6 : 4,
        }))
        if (
          addresses.length === 0 ||
          addresses.some(({ address }) => isPrivateOrReservedAddress(address))
        ) {
          callback(new UnsafeWebhookEndpointError(), "", 4)
          return
        }
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
    new Promise<Response>((resolve, reject) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      )
      const headers = new Headers(init?.headers)
      const request = httpsRequest(
        {
          host: url.hostname,
          port: url.port === "" ? 443 : Number(url.port),
          path: `${url.pathname}${url.search}`,
          method: init?.method ?? "POST",
          headers: Object.fromEntries(headers.entries()),
          signal: init?.signal ?? undefined,
          lookup: pinnedLookup,
        },
        (incoming) => {
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
              reject(new Error("Webhook response exceeded the maximum allowed size."))
              return
            }
            chunks.push(chunk)
          })
          incoming.on("end", () => {
            const body =
              incoming.statusCode === 204 || incoming.statusCode === 304
                ? null
                : new Uint8Array(Buffer.concat(chunks))
            resolve(
              new Response(body, {
                status: incoming.statusCode ?? 500,
                headers: responseHeaders,
              }),
            )
          })
          incoming.on("error", reject)
        },
      )
      request.on("error", reject)
      if (typeof init?.body === "string") request.write(init.body)
      else if (init?.body instanceof Uint8Array) request.write(init.body)
      request.end()
    })
}

function isPrivateOrReservedAddress(address: string): boolean {
  const ipVersion = isIP(address)
  if (ipVersion === 0) return true
  if (ipVersion === 6) {
    const normalized = address.toLowerCase()
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized === "0:0:0:0:0:0:0:1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    )
  }
  const [first = 0, second = 0] = address.split(".").map(Number)
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  )
}

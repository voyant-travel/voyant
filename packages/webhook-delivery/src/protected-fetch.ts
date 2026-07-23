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
  const rawHostname = new URL(value).hostname
  const hostname =
    rawHostname.startsWith("[") && rawHostname.endsWith("]")
      ? rawHostname.slice(1, -1)
      : rawHostname
  const addresses = isIP(hostname) === 0 ? await resolveHost(hostname) : [hostname]
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
      assertOutboundWebhookEndpointUrl(url.href)
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
    const bytes = parseIpv6(address)
    if (!bytes) return true

    // Only native global unicast (2000::/3) is eligible. This rejects
    // unspecified, loopback, IPv4-mapped, unique-local, link-local,
    // site-local, multicast, and all other special-purpose ranges by default.
    if (((bytes[0] ?? 0) & 0xe0) !== 0x20) return true

    return (
      hasIpv6Prefix(bytes, [0x20, 0x01, 0x00, 0x00], 23) || // IETF protocol assignments
      hasIpv6Prefix(bytes, [0x20, 0x01, 0x00, 0x02, 0x00, 0x00], 48) || // benchmarking
      hasIpv6Prefix(bytes, [0x20, 0x01, 0x0d, 0xb8], 32) || // documentation
      hasIpv6Prefix(bytes, [0x20, 0x02], 16) || // 6to4 transition space
      hasIpv6Prefix(bytes, [0x3f, 0xff, 0x00], 20) // documentation
    )
  }
  const [first = 0, second = 0, third = 0] = address.split(".").map(Number)
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && (third === 0 || third === 2)) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  )
}

function parseIpv6(address: string): Uint8Array | null {
  const withoutZone = address.split("%", 1)[0]?.toLowerCase()
  if (!withoutZone) return null
  let normalized = withoutZone
  const ipv4Match = normalized.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/)
  if (ipv4Match) {
    const octets = ipv4Match[2]?.split(".").map(Number) ?? []
    if (
      octets.length !== 4 ||
      octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
    ) {
      return null
    }
    const high = (((octets[0] ?? 0) << 8) | (octets[1] ?? 0)).toString(16)
    const low = (((octets[2] ?? 0) << 8) | (octets[3] ?? 0)).toString(16)
    normalized = `${ipv4Match[1]}${high}:${low}`
  }

  const halves = normalized.split("::")
  if (halves.length > 2) return null
  const left = halves[0] ? halves[0].split(":") : []
  const right = halves[1] ? halves[1].split(":") : []
  const zeroCount = halves.length === 2 ? 8 - left.length - right.length : 0
  if (zeroCount < 0 || (halves.length === 1 && left.length !== 8)) return null
  const groups = [...left, ...Array.from({ length: zeroCount }, () => "0"), ...right]
  if (groups.length !== 8) return null
  const bytes = new Uint8Array(16)
  for (const [index, group] of groups.entries()) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null
    const value = Number.parseInt(group, 16)
    bytes[index * 2] = value >> 8
    bytes[index * 2 + 1] = value & 0xff
  }
  return bytes
}

function hasIpv6Prefix(address: Uint8Array, prefix: readonly number[], bits: number): boolean {
  const fullBytes = Math.floor(bits / 8)
  for (let index = 0; index < fullBytes; index += 1) {
    if (address[index] !== prefix[index]) return false
  }
  const remaining = bits % 8
  if (remaining === 0) return true
  const mask = (0xff << (8 - remaining)) & 0xff
  return ((address[fullBytes] ?? 0) & mask) === ((prefix[fullBytes] ?? 0) & mask)
}

export function randomBytesHex(lengthBytes: number): string {
  const bytes = new Uint8Array(lengthBytes)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input
  const hash = await crypto.subtle.digest("SHA-256", data.buffer as ArrayBuffer)
  const arr = Array.from(new Uint8Array(hash))
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function constantTimeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length, 1)
  let diff = a.length === b.length ? 0 : 1
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0)
  }
  return diff === 0
}

export function generateNumericCode(length: number): string {
  const max = 10 ** length
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  const code = Number((buf[0] ?? 0) % max)
  return String(code).padStart(length, "0")
}

/**
 * SHA-256 hash a string using Web Crypto API.
 * Returns the hash as a base64url string without padding,
 * matching Better Auth's `defaultKeyHasher` format.
 */
export async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const bytes = new Uint8Array(hashBuffer)
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  const base64 = btoa(binary)
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Unsign a Better Auth session cookie.
 * Better Auth signs cookies as: encodeURIComponent(value + "." + base64(HMAC-SHA256(value, secret)))
 */
export async function unsignCookie(rawCookieValue: string, secret: string): Promise<string | null> {
  const decoded = decodeURIComponent(rawCookieValue)
  const lastDot = decoded.lastIndexOf(".")
  if (lastDot < 1) return null

  const value = decoded.substring(0, lastDot)
  const signature = decoded.substring(lastDot + 1)
  if (signature.length !== 44 || !signature.endsWith("=")) return null

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  )

  const sigBinStr = atob(signature)
  const sigBytes = new Uint8Array(sigBinStr.length)
  for (let i = 0; i < sigBinStr.length; i++) sigBytes[i] = sigBinStr.charCodeAt(i)

  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(value))
  return valid ? value : null
}

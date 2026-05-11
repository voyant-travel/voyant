import type { Context } from "hono"

import { ForbiddenApiError, UnauthorizedApiError } from "./validation.js"

export interface PublicCapabilityPayload {
  v: 1
  scope: string
  subjectId: string
  actions: string[]
  iat: number
  exp: number
  jti?: string
}

export interface CreatePublicCapabilityOptions {
  secret: string
  scope: string
  subjectId: string
  actions: string[]
  ttlSeconds: number
  now?: Date
  jti?: string
}

export interface VerifyPublicCapabilityOptions {
  secret: string
  scope: string
  subjectId: string
  action: string
  now?: Date
}

export interface PublicCapabilityCookieOptions {
  name: string
  token: string
  expiresAt: Date
  secure?: boolean
  sameSite?: "Strict" | "Lax" | "None"
  path?: string
}

const TOKEN_TYPE = "voyant-public-capability+jwt"
const DEFAULT_CAPABILITY_HEADER = "X-Voyant-Checkout-Capability"

function getWebCrypto(): Crypto {
  if (globalThis.crypto?.subtle) {
    return globalThis.crypto
  }

  throw new Error("No crypto implementation available")
}

function encodeBase64Url(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function decodeBase64Url(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
  return atob(padded)
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false

  let result = 0
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return result === 0
}

async function signMessage(message: string, secret: string) {
  const crypto = getWebCrypto()
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message))
  return encodeBase64Url(new Uint8Array(signature))
}

function validateSecret(secret: string) {
  if (secret.length < 32) {
    throw new Error("Public capability secret must be at least 32 characters")
  }
}

export async function createPublicCapabilityToken(
  options: CreatePublicCapabilityOptions,
): Promise<{ token: string; payload: PublicCapabilityPayload; expiresAt: Date }> {
  validateSecret(options.secret)

  const issuedAt = Math.floor((options.now ?? new Date()).getTime() / 1000)
  const expiresAtSeconds = issuedAt + options.ttlSeconds
  const payload: PublicCapabilityPayload = {
    v: 1,
    scope: options.scope,
    subjectId: options.subjectId,
    actions: Array.from(new Set(options.actions)).sort(),
    iat: issuedAt,
    exp: expiresAtSeconds,
    ...(options.jti ? { jti: options.jti } : {}),
  }
  const header = { alg: "HS256", typ: TOKEN_TYPE }
  const headerB64 = encodeBase64Url(JSON.stringify(header))
  const payloadB64 = encodeBase64Url(JSON.stringify(payload))
  const message = `${headerB64}.${payloadB64}`
  const signature = await signMessage(message, options.secret)

  return {
    token: `${message}.${signature}`,
    payload,
    expiresAt: new Date(expiresAtSeconds * 1000),
  }
}

export async function verifyPublicCapabilityToken(
  token: string,
  options: VerifyPublicCapabilityOptions,
): Promise<PublicCapabilityPayload> {
  validateSecret(options.secret)

  const [headerB64, payloadB64, signature] = token.split(".")
  if (!headerB64 || !payloadB64 || !signature) {
    throw new UnauthorizedApiError("Invalid checkout session capability")
  }

  const message = `${headerB64}.${payloadB64}`
  const expectedSignature = await signMessage(message, options.secret)
  if (!constantTimeEqual(signature, expectedSignature)) {
    throw new UnauthorizedApiError("Invalid checkout session capability")
  }

  let header: { typ?: unknown }
  let payload: PublicCapabilityPayload
  try {
    header = JSON.parse(decodeBase64Url(headerB64)) as { typ?: unknown }
    payload = JSON.parse(decodeBase64Url(payloadB64)) as PublicCapabilityPayload
  } catch {
    throw new UnauthorizedApiError("Invalid checkout session capability")
  }

  if (header.typ !== TOKEN_TYPE || payload.v !== 1) {
    throw new UnauthorizedApiError("Invalid checkout session capability")
  }

  const now = Math.floor((options.now ?? new Date()).getTime() / 1000)
  if (payload.exp < now) {
    throw new UnauthorizedApiError("Expired checkout session capability")
  }

  if (payload.scope !== options.scope || payload.subjectId !== options.subjectId) {
    throw new ForbiddenApiError("Checkout session capability is not scoped to this resource")
  }

  if (!payload.actions.includes(options.action)) {
    throw new ForbiddenApiError("Checkout session capability cannot perform this action")
  }

  return payload
}

export function extractPublicCapabilityToken(
  c: Context,
  options: { headerName?: string; cookieName?: string } = {},
) {
  const headerName = options.headerName ?? DEFAULT_CAPABILITY_HEADER
  const headerToken = c.req.header(headerName)
  if (headerToken) {
    return headerToken
  }

  const cookieName = options.cookieName
  if (!cookieName) {
    return null
  }

  const cookieHeader = c.req.header("Cookie")
  if (!cookieHeader) {
    return null
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.trim().split("=")
    if (rawName === cookieName) {
      return decodeURIComponent(rawValueParts.join("="))
    }
  }

  return null
}

export function serializePublicCapabilityCookie(options: PublicCapabilityCookieOptions) {
  const secure = options.secure ?? true
  const sameSite = options.sameSite ?? "Lax"
  const path = options.path ?? "/"
  const parts = [
    `${options.name}=${encodeURIComponent(options.token)}`,
    "HttpOnly",
    `SameSite=${sameSite}`,
    `Path=${path}`,
    `Expires=${options.expiresAt.toUTCString()}`,
  ]

  if (secure) {
    parts.push("Secure")
  }

  return parts.join("; ")
}

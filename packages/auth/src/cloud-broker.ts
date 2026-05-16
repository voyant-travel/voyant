export const VOYANT_CLOUD_ADMIN_AUTH_STATE_COOKIE = "voyant-cloud-admin-auth"
export const VOYANT_CLOUD_ADMIN_ASSERTION_ISSUER = "https://api.voyantjs.com"

const DEFAULT_STATE_TTL_SECONDS = 300
const RANDOM_BYTES = 32

export type CloudAdminAssertion = {
  iss: typeof VOYANT_CLOUD_ADMIN_ASSERTION_ISSUER
  aud: string
  sub: string
  email: string
  emailVerified: boolean
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  image?: string | null
  workosUserId: string
  workosOrganizationId: string
  platformOrganizationId: string
  platformOrganizationSlug: string
  deploymentId: string
  appId?: string | null
  environment?: string | null
  membershipId?: string | null
  roleSlug?: string | null
  roleName?: string | null
  surfaces?: string[] | null
  nonce: string
  iat: number
  exp: number
}

export type CloudAdminAuthStartConfig = {
  cloudAuthStartUrl: string
  deploymentId: string
  adminCallbackUrl: string
  cookieSecret: string
  appId?: string | null
  environment?: string | null
  surface?: string | null
  stateTtlSeconds?: number
}

export type CloudAdminAuthState = {
  state: string
  nonce: string
  deploymentId: string
  redirectUri: string
  next: string
  expiresAt: number
}

export type CreateCloudAdminAuthStartInput = {
  requestUrl: string
  next?: string | null
  config: CloudAdminAuthStartConfig
  now?: Date
  randomState?: string
  randomNonce?: string
}

export type CreateCloudAdminAuthStartResult = {
  redirectUrl: string
  state: CloudAdminAuthState
  setCookie: string
}

export type VerifyCloudAdminAuthCallbackInput = {
  requestUrl: string
  cookieHeader?: string | null
  cookieSecret: string
  now?: Date
}

export type VerifyCloudAdminAuthCallbackResult =
  | {
      ok: true
      code: string
      state: CloudAdminAuthState
      clearCookie: string
    }
  | {
      ok: false
      error: "cloud_error" | "invalid_request" | "invalid_state" | "expired_state"
      description?: string
      cloudError?: string
      clearCookie: string
    }

export async function createCloudAdminAuthStart({
  requestUrl,
  next,
  config,
  now = new Date(),
  randomState,
  randomNonce,
}: CreateCloudAdminAuthStartInput): Promise<CreateCloudAdminAuthStartResult> {
  validateStartConfig(config)

  const parsedRequestUrl = new URL(requestUrl)
  const ttlSeconds = config.stateTtlSeconds ?? DEFAULT_STATE_TTL_SECONDS
  const state: CloudAdminAuthState = {
    state: randomState ?? randomToken(),
    nonce: randomNonce ?? randomToken(),
    deploymentId: config.deploymentId.trim(),
    redirectUri: normalizeAbsoluteUrl(config.adminCallbackUrl, "adminCallbackUrl"),
    next: normalizeCloudAdminAuthNext(next, parsedRequestUrl.origin),
    expiresAt: now.getTime() + ttlSeconds * 1000,
  }
  const redirectUrl = new URL(config.cloudAuthStartUrl)
  redirectUrl.searchParams.set("deployment_id", state.deploymentId)
  redirectUrl.searchParams.set("redirect_uri", state.redirectUri)
  redirectUrl.searchParams.set("state", state.state)
  redirectUrl.searchParams.set("nonce", state.nonce)
  redirectUrl.searchParams.set("surface", config.surface?.trim() || "admin")
  redirectUrl.searchParams.set("next", state.next)

  if (config.appId?.trim()) {
    redirectUrl.searchParams.set("app_id", config.appId.trim())
  }
  if (config.environment?.trim()) {
    redirectUrl.searchParams.set("environment", config.environment.trim())
  }

  return {
    redirectUrl: redirectUrl.toString(),
    state,
    setCookie: await buildCloudAdminAuthStateCookie({
      state,
      secret: config.cookieSecret,
      secure: parsedRequestUrl.protocol === "https:",
      path: cloudAuthCookiePath(new URL(state.redirectUri).pathname),
      maxAgeSeconds: ttlSeconds,
    }),
  }
}

export async function verifyCloudAdminAuthCallback({
  requestUrl,
  cookieHeader,
  cookieSecret,
  now = new Date(),
}: VerifyCloudAdminAuthCallbackInput): Promise<VerifyCloudAdminAuthCallbackResult> {
  assertUsableSecret(cookieSecret)

  const url = new URL(requestUrl)
  const clearCookie = buildClearCloudAdminAuthStateCookie(
    url.protocol === "https:",
    cloudAuthCookiePath(url.pathname),
  )
  const cloudError = url.searchParams.get("error")
  if (cloudError) {
    return {
      ok: false,
      error: "cloud_error",
      cloudError,
      description: url.searchParams.get("error_description") ?? undefined,
      clearCookie,
    }
  }

  const stateParam = url.searchParams.get("state")
  const code = url.searchParams.get("code")
  if (!stateParam || !code) {
    return { ok: false, error: "invalid_request", clearCookie }
  }

  const stateCookie = readCookie(cookieHeader, VOYANT_CLOUD_ADMIN_AUTH_STATE_COOKIE)
  if (!stateCookie) {
    return { ok: false, error: "invalid_state", clearCookie }
  }

  const state = await verifyCloudAdminAuthStateCookie(stateCookie, cookieSecret)
  if (!state || state.state !== stateParam) {
    return { ok: false, error: "invalid_state", clearCookie }
  }

  if (state.expiresAt <= now.getTime()) {
    return { ok: false, error: "expired_state", clearCookie }
  }

  return { ok: true, code, state, clearCookie }
}

export function normalizeCloudAdminAuthNext(
  next: string | null | undefined,
  adminOrigin: string,
): string {
  const value = next?.trim()
  if (!value) return "/"

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value
  }

  try {
    const url = new URL(value)
    if (url.origin !== adminOrigin) return "/"
    return `${url.pathname}${url.search}${url.hash}` || "/"
  } catch {
    return "/"
  }
}

export function buildClearCloudAdminAuthStateCookie(secure: boolean, path = "/auth/cloud"): string {
  return serializeCookie(VOYANT_CLOUD_ADMIN_AUTH_STATE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path,
    sameSite: "Lax",
    secure,
  })
}

async function buildCloudAdminAuthStateCookie({
  state,
  secret,
  secure,
  path,
  maxAgeSeconds,
}: {
  state: CloudAdminAuthState
  secret: string
  secure: boolean
  path: string
  maxAgeSeconds: number
}): Promise<string> {
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(state)))
  const signature = await hmac(payload, secret)

  return serializeCookie(VOYANT_CLOUD_ADMIN_AUTH_STATE_COOKIE, `${payload}.${signature}`, {
    httpOnly: true,
    maxAge: maxAgeSeconds,
    path,
    sameSite: "Lax",
    secure,
  })
}

async function verifyCloudAdminAuthStateCookie(
  cookieValue: string,
  secret: string,
): Promise<CloudAdminAuthState | null> {
  const [payload, signature, ...rest] = cookieValue.split(".")
  if (!payload || !signature || rest.length > 0) return null

  const expectedSignature = await hmac(payload, secret)
  if (!timingSafeEqual(signature, expectedSignature)) return null

  const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as unknown
  if (!isCloudAdminAuthState(parsed)) return null
  return parsed
}

function validateStartConfig(config: CloudAdminAuthStartConfig): void {
  assertUsableSecret(config.cookieSecret)
  normalizeAbsoluteUrl(config.cloudAuthStartUrl, "cloudAuthStartUrl")
  normalizeAbsoluteUrl(config.adminCallbackUrl, "adminCallbackUrl")

  if (!config.deploymentId.trim()) {
    throw new Error("Voyant Cloud auth requires deploymentId")
  }
}

function assertUsableSecret(secret: string): void {
  if (!secret || secret.length < 32) {
    throw new Error("Voyant Cloud auth requires a cookie secret with at least 32 characters")
  }
}

function normalizeAbsoluteUrl(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`Voyant Cloud auth requires ${label}`)
  }

  const url = new URL(trimmed)
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error(`Voyant Cloud auth ${label} must use HTTPS outside localhost`)
  }
  return url.toString()
}

function isCloudAdminAuthState(value: unknown): value is CloudAdminAuthState {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.state === "string" &&
    typeof candidate.nonce === "string" &&
    typeof candidate.deploymentId === "string" &&
    typeof candidate.redirectUri === "string" &&
    typeof candidate.next === "string" &&
    typeof candidate.expiresAt === "number"
  )
}

function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=")
    if (rawName === name) return rawValue.join("=")
  }

  return null
}

function cloudAuthCookiePath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/"
  const marker = "/auth/cloud/"
  const markerIndex = normalized.indexOf(marker)
  if (markerIndex >= 0) {
    return normalized.slice(0, markerIndex + marker.length - 1) || "/auth/cloud"
  }

  if (normalized.endsWith("/auth/cloud")) {
    return normalized
  }

  return "/auth/cloud"
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly: boolean
    maxAge: number
    path: string
    sameSite: "Lax" | "Strict" | "None"
    secure: boolean
  },
): string {
  const parts = [
    `${name}=${value}`,
    `Max-Age=${options.maxAge}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
  ]

  if (options.httpOnly) parts.push("HttpOnly")
  if (options.secure) parts.push("Secure")

  return parts.join("; ")
}

function randomToken(): string {
  const bytes = new Uint8Array(RANDOM_BYTES)
  globalThis.crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  )
  return base64UrlEncode(new Uint8Array(signature))
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=")
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)
  if (leftBytes.length !== rightBytes.length) return false

  let diff = 0
  for (let i = 0; i < leftBytes.length; i += 1) {
    diff |= leftBytes[i]! ^ rightBytes[i]!
  }
  return diff === 0
}

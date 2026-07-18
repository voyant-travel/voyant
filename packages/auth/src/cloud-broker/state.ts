import {
  CLOUD_STATE_COOKIE_KEY_CONTEXT,
  deriveContextKey,
} from "@voyant-travel/utils/session-claims"
import {
  base64UrlDecode,
  base64UrlEncode,
  isRecord,
  normalizeAbsoluteUrl,
  timingSafeEqual,
} from "./utils.js"

export const VOYANT_CLOUD_ADMIN_AUTH_STATE_COOKIE = "voyant-cloud-admin-auth"

const DEFAULT_STATE_TTL_SECONDS = 300
const RANDOM_BYTES = 32

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
  /** Trusted external-scheme hint for deployments behind TLS termination. */
  secureCookie?: boolean
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
      secure: new URL(state.redirectUri).protocol === "https:",
      path: cloudAuthCookiePath(new URL(state.redirectUri).pathname),
      maxAgeSeconds: ttlSeconds,
    }),
  }
}

export async function verifyCloudAdminAuthCallback({
  requestUrl,
  cookieHeader,
  cookieSecret,
  secureCookie,
  now = new Date(),
}: VerifyCloudAdminAuthCallbackInput): Promise<VerifyCloudAdminAuthCallbackResult> {
  assertUsableSecret(cookieSecret)

  const url = new URL(requestUrl)
  const clearCookie = buildClearCloudAdminAuthStateCookie(
    secureCookie ?? url.protocol === "https:",
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

export function buildClearCloudAdminAuthStateCookie(
  secure: boolean,
  path = "/auth/admin/cloud",
): string {
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

function isCloudAdminAuthState(value: unknown): value is CloudAdminAuthState {
  if (!isRecord(value)) return false
  return (
    typeof value.state === "string" &&
    typeof value.nonce === "string" &&
    typeof value.deploymentId === "string" &&
    typeof value.redirectUri === "string" &&
    typeof value.next === "string" &&
    typeof value.expiresAt === "number"
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
  if (normalized.endsWith("/callback")) return normalized.slice(0, -"/callback".length) || "/"
  if (normalized.endsWith("/cloud")) return normalized

  return "/auth/admin/cloud"
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
  const stateCookieKey = await deriveContextKey(secret, CLOUD_STATE_COOKIE_KEY_CONTEXT)
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(stateCookieKey),
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

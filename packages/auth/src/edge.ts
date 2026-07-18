/**
 * Edge-compatible session check for Next.js middleware.
 *
 * Does NOT import better-auth (which uses eval / new Function via
 * createTelemetry, incompatible with Edge Runtime).
 *
 * Instead it reads the session cookie, unsigns it using the same
 * HMAC-SHA256 scheme that better-call uses, and queries better-auth's
 * `session` + `user` tables directly via the Neon HTTP drizzle adapter.
 *
 * With the identity table collapse, authUser.id IS the userId —
 * no extra identity lookup required.
 */

import { getDb } from "@voyant-travel/db"
import {
  authSession,
  authUser,
  customerAuthSession,
  customerAuthUser,
} from "@voyant-travel/db/schema/iam"
import { and, eq, gt } from "drizzle-orm"

export interface EdgeAuthRealmOptions {
  realm?: "admin" | "customer"
  cookieName?: string
  secret?: string
}

function getAuthSecret(realm: "admin" | "customer"): string {
  if (realm === "customer") {
    return process.env.BETTER_AUTH_CUSTOMER_SECRET || ""
  }
  return process.env.BETTER_AUTH_ADMIN_SECRET || ""
}

/**
 * Unsign a Better Auth cookie value.
 *
 * Better Auth (via better-call) signs cookies as:
 *   encodeURIComponent(value + "." + base64(HMAC-SHA256(value, secret)))
 *
 * This function reverses that: URL-decode, split at last ".",
 * verify the HMAC-SHA256 signature, and return the raw value.
 */
async function unsignCookie(rawCookieValue: string, secret: string): Promise<string | null> {
  const decoded = decodeURIComponent(rawCookieValue)

  const lastDot = decoded.lastIndexOf(".")
  if (lastDot < 1) return null

  const value = decoded.substring(0, lastDot)
  const signature = decoded.substring(lastDot + 1)

  // Better Auth signatures are 44-char base64 strings ending with "="
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

function getRawCookieValue(headers: Headers, cookieNames: readonly string[]): string | null {
  const cookieHeader = headers.get("cookie")
  if (!cookieHeader) return null

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim()
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const name = trimmed.slice(0, eqIdx).trim()
    if (cookieNames.includes(name)) {
      return trimmed.slice(eqIdx + 1).trim() || null
    }
  }
  return null
}

type AuthContext = {
  userId: string | null
  email: string | null
  sessionId: string | null
}

const EMPTY: AuthContext = {
  userId: null,
  email: null,
  sessionId: null,
}

/**
 * Lightweight edge-compatible session check.
 * Safe to call from Next.js middleware.
 *
 * Returns `userId` which is Better Auth's `user.id` — the single
 * canonical user identifier after the identity table collapse.
 */
export async function getAuthContextFromHeaders(
  headers: Headers,
  options: EdgeAuthRealmOptions = {},
): Promise<AuthContext> {
  const realm = options.realm ?? "admin"
  const cookieNames = options.cookieName
    ? [options.cookieName]
    : realm === "customer"
      ? ["voyant-customer.session_token"]
      : ["voyant-admin.session_token", "better-auth.session_token"]
  const rawCookie = getRawCookieValue(headers, cookieNames)
  if (!rawCookie) return EMPTY

  const secret = options.secret ?? getAuthSecret(realm)
  if (!secret) return EMPTY

  const token = await unsignCookie(rawCookie, secret)
  if (!token) return EMPTY

  const db = getDb("edge")

  const [row] =
    realm === "customer"
      ? await db
          .select({
            sessionId: customerAuthSession.id,
            userId: customerAuthSession.userId,
            email: customerAuthUser.email,
          })
          .from(customerAuthSession)
          .innerJoin(customerAuthUser, eq(customerAuthUser.id, customerAuthSession.userId))
          .where(
            and(
              eq(customerAuthSession.token, token),
              gt(customerAuthSession.expiresAt, new Date()),
            ),
          )
          .limit(1)
      : await db
          .select({
            sessionId: authSession.id,
            userId: authSession.userId,
            email: authUser.email,
          })
          .from(authSession)
          .innerJoin(authUser, eq(authUser.id, authSession.userId))
          .where(and(eq(authSession.token, token), gt(authSession.expiresAt, new Date())))
          .limit(1)

  if (!row) return EMPTY

  return {
    userId: row.userId,
    email: row.email,
    sessionId: row.sessionId,
  }
}

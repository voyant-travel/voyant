/**
 * Better Auth handler for Hono.
 *
 * Mounts Better Auth at /auth/* for authentication operations.
 * Same-origin — no CORS needed. Session cookies work naturally.
 *
 * Also provides /auth/status (user provisioning) and /auth/me (user info).
 */

import { createBetterAuth } from "@voyantjs/auth/server"
import { ensureCurrentUserProfile, getCurrentUser } from "@voyantjs/auth/workspace"
import { getVoyantCloudClient } from "@voyantjs/cloud-sdk"
import { authUser } from "@voyantjs/db/schema/iam"
import type { VoyantRequestAuthContext } from "@voyantjs/hono"
import { sql } from "drizzle-orm"
import { type Context, Hono } from "hono"

import { getDbFromHyperdrive } from "../lib/db"

const auth = new Hono<{ Bindings: CloudflareBindings }>()
const DEFAULT_APP_URL = "http://localhost:3100"

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, "")
}

function getAppUrl(env: CloudflareBindings): string {
  const candidates = [
    env.APP_URL,
    env.DASH_BASE_URL,
    env.CORS_ALLOWLIST?.split(",")[0],
    DEFAULT_APP_URL,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return normalizeUrl(candidate)
    }
  }

  return DEFAULT_APP_URL
}

function getTrustedOrigins(env: CloudflareBindings): string[] {
  return Array.from(
    new Set(
      [env.APP_URL, env.DASH_BASE_URL, ...(env.CORS_ALLOWLIST ?? "").split(",")]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).map(normalizeUrl)
}

function getAuthBaseUrl(env: CloudflareBindings): string {
  // entry.ts strips /api before delegating to the Hono app, so Better Auth
  // sees paths like /auth/*. Its baseURL must be the origin only (no /api).
  const appUrl = getAppUrl(env)
  try {
    const parsed = new URL(appUrl)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return appUrl
  }
}

/**
 * Create a fresh Better Auth instance per request.
 *
 * Cloudflare Workers isolate I/O per request — a DB connection created in
 * one request cannot be reused by another ("Cannot perform I/O on behalf of
 * a different request"). So we must NOT cache the auth instance.
 */
function getBetterAuth(env: CloudflareBindings) {
  const db = getDbFromHyperdrive(env)
  const cloud = getVoyantCloudClient(env as unknown as Record<string, unknown>)
  const emailFrom = env.EMAIL_FROM || "Voyant <noreply@voyantcloud.app>"

  return createBetterAuth({
    db,
    secret: env.SESSION_CLAIMS_SECRET,
    baseURL: getAuthBaseUrl(env),
    basePath: "/auth",
    trustedOrigins: getTrustedOrigins(env),
    sendResetPassword: async ({ user, url }) => {
      await cloud.email.sendMessage({
        from: emailFrom,
        to: [user.email],
        subject: "Reset your password",
        html: `<p>Hi ${user.name},</p><p>Click <a href="${url}">here</a> to reset your password.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
      })
    },
    sendVerificationOTP: async ({ email, otp, type }) => {
      await cloud.email.sendMessage({
        from: emailFrom,
        to: [email],
        subject: type === "email-verification" ? "Verify your email" : "Your verification code",
        html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
      })
    },
  })
}

async function getSessionOrUnauthorized(c: Context<{ Bindings: CloudflareBindings }>) {
  const betterAuth = getBetterAuth(c.env)
  const session = await betterAuth.api.getSession({ headers: c.req.raw.headers })

  if (!session) {
    return { session: null, response: c.json({ error: "Unauthorized" }, 401) }
  }

  return { session, response: null }
}

export async function resolveAuthRequest(
  request: Request,
  env: CloudflareBindings,
): Promise<VoyantRequestAuthContext | null> {
  const betterAuth = getBetterAuth(env)
  const session = await betterAuth.api.getSession({ headers: request.headers })

  if (!session) {
    return null
  }

  return {
    userId: session.user.id,
    sessionId: session.session.id,
    organizationId: null,
    callerType: "session",
    email: session.user.email ?? null,
  }
}

/**
 * Single-tenant: every authenticated session is a staff user with full access.
 */
export async function hasAuthPermission(
  request: Request,
  env: CloudflareBindings,
): Promise<boolean> {
  const auth = await resolveAuthRequest(request, env)
  return auth !== null
}

/**
 * GET /auth/me
 * Returns the current authenticated user's profile.
 * Validates the session cookie directly (no Bearer token needed).
 */
auth.get("/auth/me", async (c) => {
  const { session, response } = await getSessionOrUnauthorized(c)
  if (!session) {
    return response
  }

  const db = getDbFromHyperdrive(c.env)
  const user = await getCurrentUser(db, { userId: session.user.id })

  if (!user) {
    return c.json({ error: "User not found" }, 404)
  }

  return c.json(user)
})

/**
 * GET /auth/status
 * Ensures the authenticated user has a user_profiles row.
 * Profile is normally created by the BA databaseHook on sign-up,
 * but this route serves as an idempotent fallback.
 */
auth.get("/auth/status", async (c) => {
  const { session } = await getSessionOrUnauthorized(c)
  if (!session) {
    return c.json({ userExists: false, authenticated: false })
  }

  const userId = session.user.id
  const db = getDbFromHyperdrive(c.env)
  const status = await ensureCurrentUserProfile(db, userId)

  if (status.reason?.startsWith("No email found")) {
    return c.json(status, 400)
  }

  if (status.reason?.startsWith("Provisioning error:")) {
    console.error("[auth/status] Error:", status.reason)
    return c.json(status, 500)
  }

  return c.json(status)
})

/**
 * GET /auth/bootstrap-status
 * Public endpoint — reveals whether any user exists.
 */
auth.get("/auth/bootstrap-status", async (c) => {
  const db = getDbFromHyperdrive(c.env)
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(authUser)
  return c.json({ hasUsers: (row?.count ?? 0) > 0 })
})

/**
 * Catch-all: delegate to Better Auth handler.
 * Sign-up is gated server-side by a `user.create.before` hook in @voyantjs/auth.
 */
auth.all("/auth/*", async (c) => {
  const betterAuth = getBetterAuth(c.env)
  const response = await betterAuth.handler(c.req.raw)
  return response
})

export default auth

/**
 * Better Auth handler for Hono.
 *
 * Mounts Better Auth at /auth/* for authentication operations.
 * Same-origin — no CORS needed. Session cookies work naturally.
 *
 * Also provides /auth/status (user provisioning) and /auth/me (user info).
 */

import { createBetterAuth } from "@voyantjs/auth/server"
import { tryGetVoyantCloudClient } from "@voyantjs/cloud-sdk"
import { authUser, userProfilesTable } from "@voyantjs/db/schema/iam"
import type { VoyantDb, VoyantRequestAuthContext } from "@voyantjs/hono"
import { eq, sql } from "drizzle-orm"
import { Hono } from "hono"

import { resolveEmailReplyTo } from "../../lib/notifications"
import { dbFromEnvForApp } from "../lib/db"

// Type ctx so that `c.get("db")` resolves to the parent app's middleware-
// set `VoyantDb` (the per-request Pool the `dbFromEnvForApp` factory
// installed). Without this, the sub-app sees `unknown` for context vars.
const auth = new Hono<{ Bindings: CloudflareBindings; Variables: { db: VoyantDb } }>()
const DEFAULT_APP_URL = "http://localhost:3300"

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
/**
 * Builds a per-call Better Auth instance. Returns the auth object plus
 * a `dispose()` the caller schedules (typically via
 * `c.executionCtx.waitUntil`) after the auth-using work has settled.
 * Without `dispose`, the Pool stays open until isolate teardown — at
 * scale that exhausts Neon's connection budget because every
 * authenticated request opens a fresh WebSocket.
 */
function getBetterAuth(env: CloudflareBindings): {
  auth: ReturnType<typeof createBetterAuth>
  dispose: () => Promise<void>
} {
  const { db, dispose } = dbFromEnvForApp(env)
  const cloud = tryGetVoyantCloudClient(env as unknown as Record<string, unknown>)
  const emailFrom = env.EMAIL_FROM || "Voyant <noreply@voyantcloud.app>"
  const emailReplyTo = resolveEmailReplyTo(env)

  const auth = createBetterAuth({
    // `db` is a `NeonDatabase` (neon-serverless WebSocket); the
    // `CreateBetterAuthOptions.db` type still references the older
    // `getDb` return union (postgres-js + neon-http). Drizzle's
    // PgDatabase surface is identical across flavors at runtime, so
    // the cast is structurally safe — better-auth's drizzleAdapter
    // works on any PgDatabase. See #500 for context.
    db: db as unknown as NonNullable<Parameters<typeof createBetterAuth>[0]>["db"],
    secret: env.SESSION_CLAIMS_SECRET,
    baseURL: getAuthBaseUrl(env),
    basePath: "/auth",
    trustedOrigins: getTrustedOrigins(env),
    sendResetPassword: async ({ user, url }) => {
      if (!cloud) {
        console.info(`[auth] reset-password (no VOYANT_CLOUD_API_KEY) → ${user.email}: ${url}`)
        return
      }
      await cloud.email.sendMessage({
        from: emailFrom,
        to: [user.email],
        subject: "Reset your password",
        html: `<p>Hi ${user.name},</p><p>Click <a href="${url}">here</a> to reset your password.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
        ...(emailReplyTo ? { replyTo: emailReplyTo } : {}),
      })
    },
    sendVerificationOTP: async ({ email, otp, type }) => {
      if (!cloud) {
        console.info(
          `[auth] verification-otp (no VOYANT_CLOUD_API_KEY) [${type}] → ${email}: ${otp}`,
        )
        return
      }
      await cloud.email.sendMessage({
        from: emailFrom,
        to: [email],
        subject: type === "email-verification" ? "Verify your email" : "Your verification code",
        html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
        ...(emailReplyTo ? { replyTo: emailReplyTo } : {}),
      })
    },
  })
  return { auth, dispose }
}

export async function resolveAuthRequest(
  request: Request,
  env: CloudflareBindings,
): Promise<VoyantRequestAuthContext | null> {
  const { auth, dispose } = getBetterAuth(env)
  try {
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session) {
      return null
    }

    return {
      userId: session.user.id,
      sessionId: session.session.id,
      organizationId: null,
      callerType: "session",
      actor: "staff",
      email: session.user.email ?? null,
    }
  } finally {
    // No `executionCtx` reachable here (called from middleware that
    // doesn't pass one through). Await inline so the WebSocket closes
    // before this fn returns.
    await dispose()
  }
}

/**
 * Single-tenant: every authenticated session is a staff user with full access.
 * When `resolveAuthRequest` has already granted a session, permissions are
 * implicitly allowed. If you need granular RBAC later, switch on
 * `user_profiles.isSuperAdmin` / `isSupportUser` here.
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
  const { auth: betterAuth, dispose } = getBetterAuth(c.env)
  let session: Awaited<ReturnType<typeof betterAuth.api.getSession>>
  try {
    session = await betterAuth.api.getSession({ headers: c.req.raw.headers })
  } finally {
    // Schedule dispose AFTER queries settle. waitUntil keeps the
    // worker alive while the WebSocket close handshake completes.
    c.executionCtx.waitUntil(dispose())
  }
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const db = c.get("db")

  const [row] = await db
    .select({
      id: authUser.id,
      email: authUser.email,
      createdAt: authUser.createdAt,
      firstName: userProfilesTable.firstName,
      lastName: userProfilesTable.lastName,
      locale: userProfilesTable.locale,
      timezone: userProfilesTable.timezone,
      uiPrefs: userProfilesTable.uiPrefs,
      avatarUrl: userProfilesTable.avatarUrl,
      isSuperAdmin: userProfilesTable.isSuperAdmin,
      isSupportUser: userProfilesTable.isSupportUser,
    })
    .from(authUser)
    .leftJoin(userProfilesTable, eq(userProfilesTable.id, authUser.id))
    .where(eq(authUser.id, session.user.id))
    .limit(1)

  if (!row) {
    return c.json({ error: "User not found" }, 404)
  }

  return c.json({
    id: row.id,
    email: row.email,
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    locale: row.locale ?? "en",
    timezone: row.timezone ?? null,
    uiPrefs: (row.uiPrefs as Record<string, unknown> | null) ?? null,
    isSuperAdmin: row.isSuperAdmin ?? false,
    isSupportUser: row.isSupportUser ?? false,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    profilePictureUrl: row.avatarUrl ?? null,
  })
})

/**
 * GET /auth/status
 * Ensures the authenticated user has a user_profiles row.
 * Profile is normally created by the BA databaseHook on sign-up,
 * but this route serves as an idempotent fallback.
 */
auth.get("/auth/status", async (c) => {
  const { auth: betterAuth, dispose } = getBetterAuth(c.env)
  let session: Awaited<ReturnType<typeof betterAuth.api.getSession>>
  try {
    session = await betterAuth.api.getSession({ headers: c.req.raw.headers })
  } finally {
    c.executionCtx.waitUntil(dispose())
  }
  if (!session) {
    return c.json({ userExists: false, authenticated: false })
  }

  const userId = session.user.id
  const db = c.get("db")

  try {
    const [existingProfile] = await db
      .select({ id: userProfilesTable.id })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.id, userId))
      .limit(1)

    if (existingProfile) {
      return c.json({ userExists: true, authenticated: true })
    }

    // Profile doesn't exist yet — create from BA user data
    const [baUser] = await db
      .select({ name: authUser.name, email: authUser.email, image: authUser.image })
      .from(authUser)
      .where(eq(authUser.id, userId))
      .limit(1)

    if (!baUser?.email) {
      return c.json(
        { userExists: false, authenticated: true, reason: `No email found for user ${userId}.` },
        400,
      )
    }

    const nameParts = baUser.name?.split(" ") ?? []
    const firstName = nameParts[0] ?? null
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null

    await db
      .insert(userProfilesTable)
      .values({ id: userId, firstName, lastName, avatarUrl: baUser.image ?? null })
      .onConflictDoNothing()

    return c.json({ userExists: true, authenticated: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[auth/status] Error:", message)
    return c.json(
      { userExists: false, authenticated: true, reason: `Provisioning error: ${message}` },
      500,
    )
  }
})

/**
 * GET /auth/bootstrap-status
 * Public endpoint — reveals whether any user exists. Used by the sign-in /
 * sign-up route loaders to pick the right flow.
 */
auth.get("/auth/bootstrap-status", async (c) => {
  const db = c.get("db")
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(authUser)
  return c.json({ hasUsers: (row?.count ?? 0) > 0 })
})

/**
 * Catch-all: delegate to Better Auth handler.
 * Handles sign-in, sign-up, sign-out, password reset, OAuth callbacks, etc.
 *
 * Sign-up is gated by a `user.create.before` hook in @voyantjs/auth — once a
 * user exists, the hook throws and BA returns an error to the client.
 */
auth.all("/auth/*", async (c) => {
  const { auth: betterAuth, dispose } = getBetterAuth(c.env)
  try {
    return await betterAuth.handler(c.req.raw)
  } finally {
    c.executionCtx.waitUntil(dispose())
  }
})

export default auth

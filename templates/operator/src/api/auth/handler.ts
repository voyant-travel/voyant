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

type BetterAuthApiKeyApi = {
  listApiKeys: (args: { query?: Record<string, unknown>; headers: Headers }) => Promise<unknown>
  createApiKey: (args: { body: Record<string, unknown>; headers?: Headers }) => Promise<unknown>
  updateApiKey: (args: { body: Record<string, unknown>; headers?: Headers }) => Promise<unknown>
  deleteApiKey: (args: { body: Record<string, unknown>; headers: Headers }) => Promise<unknown>
}

type ApiTokenErrorStatus = 400 | 401 | 403 | 404 | 429 | 500

function normalizeApiTokenErrorStatus(status: number | undefined): ApiTokenErrorStatus {
  if (status === 401 || status === 403 || status === 404 || status === 429 || status === 500) {
    return status
  }
  return 400
}

function toAuthApiErrorResponse(error: unknown) {
  const candidate = error as { status?: number; statusCode?: number; message?: string }
  return {
    status: normalizeApiTokenErrorStatus(candidate.status ?? candidate.statusCode),
    body: { error: candidate.message ?? "API token request failed" },
  }
}

function readApiKeyQuery(request: Request): Record<string, unknown> {
  const query: Record<string, unknown> = {}
  const params = new URL(request.url).searchParams
  for (const key of ["configId", "organizationId", "limit", "offset", "sortBy", "sortDirection"]) {
    const value = params.get(key)
    if (value === null) continue
    query[key] = key === "limit" || key === "offset" ? Number(value) : value
  }
  return query
}

async function readOptionalJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text()
  if (!text) return {}
  const parsed = JSON.parse(text) as unknown
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {}
}

function pickFields(
  body: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const field of fields) {
    if (body[field] !== undefined) next[field] = body[field]
  }
  return next
}

async function requireApiTokenSession(
  betterAuth: ReturnType<typeof buildBetterAuth>,
  headers: Headers,
) {
  const session = await betterAuth.api.getSession({ headers })
  if (!session) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 })
  }
  return session
}

/**
 * Build a Better Auth instance backed by a caller-provided drizzle
 * client. The caller owns the Pool lifecycle (open before, dispose
 * after) so the same Pool can serve both the auth lookup and any
 * subsequent queries the route does — without spinning up a second
 * connection per request.
 *
 * Cloudflare Workers isolate I/O per request — a DB connection created
 * in one request cannot be reused by another ("Cannot perform I/O on
 * behalf of a different request"). The auth instance is therefore not
 * cached either.
 */
function buildBetterAuth(env: CloudflareBindings, db: ReturnType<typeof dbFromEnvForApp>["db"]) {
  const cloud = tryGetVoyantCloudClient(env as unknown as Record<string, unknown>)
  const emailFrom = env.EMAIL_FROM || "Voyant <noreply@voyantcloud.app>"
  const emailReplyTo = resolveEmailReplyTo(env)

  return createBetterAuth({
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
}

export async function resolveAuthRequest(
  request: Request,
  env: CloudflareBindings,
): Promise<VoyantRequestAuthContext | null> {
  const { db, dispose } = dbFromEnvForApp(env)
  try {
    const auth = buildBetterAuth(env, db)
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
  // The auth sub-app is mounted before the request-scoped `db`
  // middleware in `createApp` (auth routes are public — no requireAuth
  // gate), so `c.var.db` is undefined here. Build the per-request Pool
  // ourselves and use it for both better-auth's session lookup and
  // the profile query that follows.
  const { db, dispose } = dbFromEnvForApp(c.env)
  try {
    const betterAuth = buildBetterAuth(c.env, db)
    const session = await betterAuth.api.getSession({ headers: c.req.raw.headers })
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401)
    }

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
  } finally {
    // Schedule dispose AFTER queries settle. waitUntil keeps the
    // worker alive while the WebSocket close handshake completes.
    c.executionCtx.waitUntil(dispose())
  }
})

/**
 * GET /auth/status
 * Ensures the authenticated user has a user_profiles row.
 * Profile is normally created by the BA databaseHook on sign-up,
 * but this route serves as an idempotent fallback.
 */
auth.get("/auth/status", async (c) => {
  // See `/auth/me` above — auth sub-app runs before the request `db`
  // middleware, so own the Pool here.
  const { db, dispose } = dbFromEnvForApp(c.env)
  try {
    const betterAuth = buildBetterAuth(c.env, db)
    const session = await betterAuth.api.getSession({ headers: c.req.raw.headers })
    if (!session) {
      return c.json({ userExists: false, authenticated: false })
    }

    const userId = session.user.id

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
  } finally {
    c.executionCtx.waitUntil(dispose())
  }
})

/**
 * GET /auth/bootstrap-status
 * Public endpoint — reveals whether any user exists. Used by the sign-in /
 * sign-up route loaders to pick the right flow.
 */
auth.get("/auth/bootstrap-status", async (c) => {
  // See `/auth/me` above — auth sub-app runs before the request `db`
  // middleware, so own the Pool here.
  const { db, dispose } = dbFromEnvForApp(c.env)
  try {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(authUser)
    return c.json({ hasUsers: (row?.count ?? 0) > 0 })
  } finally {
    c.executionCtx.waitUntil(dispose())
  }
})

auth.get("/auth/api-tokens", async (c) => {
  const { db, dispose } = dbFromEnvForApp(c.env)
  try {
    const betterAuth = buildBetterAuth(c.env, db)
    const api = betterAuth.api as unknown as BetterAuthApiKeyApi
    const result = await api.listApiKeys({
      query: readApiKeyQuery(c.req.raw),
      headers: c.req.raw.headers,
    })
    return c.json(result)
  } catch (error) {
    const response = toAuthApiErrorResponse(error)
    return c.json(response.body, response.status)
  } finally {
    c.executionCtx.waitUntil(dispose())
  }
})

auth.post("/auth/api-tokens", async (c) => {
  const { db, dispose } = dbFromEnvForApp(c.env)
  try {
    const betterAuth = buildBetterAuth(c.env, db)
    const api = betterAuth.api as unknown as BetterAuthApiKeyApi
    const body = await readOptionalJson(c.req.raw)
    const session = await requireApiTokenSession(betterAuth, c.req.raw.headers)
    const result = await api.createApiKey({
      body: {
        ...pickFields(body, [
          "configId",
          "name",
          "expiresIn",
          "remaining",
          "prefix",
          "organizationId",
          "metadata",
          "permissions",
        ]),
        userId: session.user.id,
      },
    })
    return c.json(result, 201)
  } catch (error) {
    const response = toAuthApiErrorResponse(error)
    return c.json(response.body, response.status)
  } finally {
    c.executionCtx.waitUntil(dispose())
  }
})

auth.post("/auth/api-tokens/:keyId", async (c) => {
  const { db, dispose } = dbFromEnvForApp(c.env)
  try {
    const betterAuth = buildBetterAuth(c.env, db)
    const api = betterAuth.api as unknown as BetterAuthApiKeyApi
    const body = await readOptionalJson(c.req.raw)
    const session = await requireApiTokenSession(betterAuth, c.req.raw.headers)
    const result = await api.updateApiKey({
      body: {
        ...pickFields(body, [
          "configId",
          "name",
          "enabled",
          "expiresIn",
          "metadata",
          "permissions",
        ]),
        keyId: c.req.param("keyId"),
        userId: session.user.id,
      },
    })
    return c.json(result)
  } catch (error) {
    const response = toAuthApiErrorResponse(error)
    return c.json(response.body, response.status)
  } finally {
    c.executionCtx.waitUntil(dispose())
  }
})

auth.delete("/auth/api-tokens/:keyId", async (c) => {
  const { db, dispose } = dbFromEnvForApp(c.env)
  try {
    const betterAuth = buildBetterAuth(c.env, db)
    const api = betterAuth.api as unknown as BetterAuthApiKeyApi
    const body = await readOptionalJson(c.req.raw)
    const result = await api.deleteApiKey({
      body: { ...pickFields(body, ["configId"]), keyId: c.req.param("keyId") },
      headers: c.req.raw.headers,
    })
    return c.json(result)
  } catch (error) {
    const response = toAuthApiErrorResponse(error)
    return c.json(response.body, response.status)
  } finally {
    c.executionCtx.waitUntil(dispose())
  }
})

/**
 * Catch-all: delegate to Better Auth handler.
 * Handles sign-in, sign-up, sign-out, password reset, OAuth callbacks, etc.
 *
 * Sign-up is gated by a `user.create.before` hook in @voyantjs/auth — once a
 * user exists, the hook throws and BA returns an error to the client.
 */
auth.all("/auth/*", async (c) => {
  const { db, dispose } = dbFromEnvForApp(c.env)
  try {
    const betterAuth = buildBetterAuth(c.env, db)
    return await betterAuth.handler(c.req.raw)
  } finally {
    c.executionCtx.waitUntil(dispose())
  }
})

export default auth

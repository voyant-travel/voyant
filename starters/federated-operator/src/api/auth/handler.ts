import {
  createBetterAuth,
  handleApiTokenManagementRequest,
  handleOrganizationMembersRequest,
} from "@voyant-travel/auth/server"
import { ensureCurrentUserProfile } from "@voyant-travel/auth/workspace"
import { authUser, type SelectApikey, userProfilesTable } from "@voyant-travel/db/schema/iam"
import type { VoyantDb, VoyantRequestAuthContext } from "@voyant-travel/hono"
import {
  handleApiError,
  reportException,
  requestId,
} from "@voyant-travel/hono/middleware/error-boundary"
import { getRequestId } from "@voyant-travel/hono/observability"
import { eq, sql } from "drizzle-orm"
import { type Context, Hono } from "hono"

import type { BootstrapStatus, CurrentUser } from "@/lib/current-user-model"
import { FEDERATED_OPERATOR_APP_NAME, federatedOperatorReporter } from "@/lib/observability"
import { dbFromEnvForApp } from "../lib/db"

type AuthHonoEnv = { Bindings: CloudflareBindings; Variables: { db: VoyantDb } }

const auth = new Hono<AuthHonoEnv>()

auth.use("*", requestId)
auth.use("*", async (c, next) => {
  await next()
  if (c.res.status >= 500) {
    reportException(federatedOperatorReporter, c, {
      requestId: getRequestId() ?? "",
      app: FEDERATED_OPERATOR_APP_NAME,
      error: new Error(`auth handler returned HTTP ${c.res.status}`),
      context: { path: c.req.path, method: c.req.method, status: c.res.status, surface: "auth" },
    })
  }
})
auth.onError((err, c) =>
  handleApiError(err, c, {
    reporter: federatedOperatorReporter,
    appName: FEDERATED_OPERATOR_APP_NAME,
  }),
)

const DEFAULT_APP_URL = "http://localhost:3310"
const FULL_ACCESS_SCOPES = ["*"]

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
  const appUrl = getAppUrl(env)
  try {
    const parsed = new URL(appUrl)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return appUrl
  }
}

function allowAuthSecretLogging(env: CloudflareBindings): boolean {
  return env.VOYANT_AUTH_LOG_SECRET_FALLBACKS === "1"
}

function buildBetterAuth(env: CloudflareBindings, db: ReturnType<typeof dbFromEnvForApp>["db"]) {
  const authDb = db as NonNullable<Parameters<typeof createBetterAuth>[0]>["db"]

  return createBetterAuth({
    db: authDb,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: getAuthBaseUrl(env),
    basePath: "/auth",
    trustedOrigins: getTrustedOrigins(env),
    sendResetPassword: async ({ user, url }) => {
      if (allowAuthSecretLogging(env)) {
        console.info(`[auth] reset-password -> ${user.email}: ${url}`)
        return
      }
      throw new Error("Password reset email provider is not configured")
    },
    sendVerificationOTP: async ({ email, otp, type }) => {
      if (allowAuthSecretLogging(env)) {
        console.info(`[auth] verification-otp [${type}] -> ${email}: ${otp}`)
        return
      }
      console.warn(`[auth] verification OTP requested for ${email}; enable dev logging to show it.`)
    },
  })
}

export async function resolveAuthRequest(
  request: Request,
  env: CloudflareBindings,
): Promise<VoyantRequestAuthContext | null> {
  const { db, dispose } = dbFromEnvForApp(env)
  try {
    const betterAuth = buildBetterAuth(env, db)
    const session = await betterAuth.api.getSession({ headers: request.headers })

    if (!session) {
      return null
    }

    return {
      userId: session.user.id,
      sessionId: session.session.id,
      organizationId: null,
      callerType: "session",
      actor: "staff",
      scopes: FULL_ACCESS_SCOPES,
      email: session.user.email ?? null,
    }
  } finally {
    await dispose()
  }
}

export async function hasAuthPermission(
  request: Request,
  env: CloudflareBindings,
): Promise<boolean> {
  return (await resolveAuthRequest(request, env)) !== null
}

export async function validateApiTokenAccess(
  _env: CloudflareBindings,
  _db: VoyantDb,
  _apiKey: SelectApikey,
): Promise<boolean> {
  return true
}

class CurrentUserNotFoundError extends Error {
  constructor() {
    super("User not found")
    this.name = "CurrentUserNotFoundError"
  }
}

export async function getCurrentUserForRequest(
  request: Request,
  env: CloudflareBindings,
): Promise<CurrentUser | null> {
  const { db, dispose } = dbFromEnvForApp(env)
  try {
    const betterAuth = buildBetterAuth(env, db)
    const session = await betterAuth.api.getSession({ headers: request.headers })
    if (!session) {
      return null
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
      throw new CurrentUserNotFoundError()
    }

    return {
      id: row.id,
      email: row.email ?? session.user.email ?? "",
      firstName: row.firstName ?? null,
      lastName: row.lastName ?? null,
      locale: row.locale ?? "en",
      timezone: row.timezone ?? null,
      uiPrefs: (row.uiPrefs as CurrentUser["uiPrefs"]) ?? null,
      isSuperAdmin: row.isSuperAdmin ?? false,
      isSupportUser: row.isSupportUser ?? false,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      profilePictureUrl: row.avatarUrl ?? null,
    }
  } finally {
    await dispose()
  }
}

export async function getBootstrapStatusForRequest(
  _request: Request,
  env: CloudflareBindings,
): Promise<BootstrapStatus> {
  const { db, dispose } = dbFromEnvForApp(env)
  try {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(authUser)
    return { hasUsers: (row?.count ?? 0) > 0, authMode: "local" }
  } finally {
    await dispose()
  }
}

auth.get("/auth/me", async (c) => {
  try {
    const currentUser = await getCurrentUserForRequest(c.req.raw, c.env)
    if (!currentUser) {
      return c.json({ error: "Unauthorized" }, 401)
    }
    return c.json(currentUser)
  } catch (error) {
    if (error instanceof CurrentUserNotFoundError) {
      return c.json({ error: "User not found" }, 404)
    }
    throw error
  }
})

auth.get("/auth/status", async (c) => {
  const { db, dispose } = dbFromEnvForApp(c.env)
  try {
    const betterAuth = buildBetterAuth(c.env, db)
    const session = await betterAuth.api.getSession({ headers: c.req.raw.headers })
    if (!session) {
      return c.json({ userExists: false, authenticated: false })
    }

    const status = await ensureCurrentUserProfile(
      db as Parameters<typeof ensureCurrentUserProfile>[0],
      session.user.id,
    )
    if (!status.userExists && status.authenticated) {
      console.error("[auth/status] Error:", status.reason)
      return c.json(status, 500)
    }

    return c.json(status)
  } finally {
    c.executionCtx.waitUntil(dispose())
  }
})

auth.get("/auth/bootstrap-status", async (c) => {
  return c.json(await getBootstrapStatusForRequest(c.req.raw, c.env))
})

async function handleApiTokensFacade(c: Context<AuthHonoEnv>) {
  const { db, dispose } = dbFromEnvForApp(c.env)
  try {
    const betterAuth = buildBetterAuth(c.env, db)
    return (
      (await handleApiTokenManagementRequest(c.req.raw, betterAuth, {
        db,
      })) ?? c.json({ error: "Not found" }, 404)
    )
  } finally {
    c.executionCtx.waitUntil(dispose())
  }
}

async function handleOrganizationMembersFacade(c: Context<AuthHonoEnv>) {
  const { db, dispose } = dbFromEnvForApp(c.env)
  try {
    const betterAuth = buildBetterAuth(c.env, db)
    return (
      (await handleOrganizationMembersRequest(c.req.raw, betterAuth, {
        db,
      })) ?? c.json({ error: "Not found" }, 404)
    )
  } finally {
    c.executionCtx.waitUntil(dispose())
  }
}

auth.all("/auth/api-tokens", handleApiTokensFacade)
auth.all("/auth/api-tokens/:keyId", handleApiTokensFacade)
auth.all("/auth/api-tokens/:keyId/rotate", handleApiTokensFacade)
auth.get("/auth/organization/list-members", handleOrganizationMembersFacade)

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

import { apiKey } from "@better-auth/api-key"
import { getDb } from "@voyantjs/db"
import {
  apikeyTable,
  authAccount,
  authSession,
  authUser,
  authVerification,
  userProfilesTable,
} from "@voyantjs/db/schema/iam"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { emailOTP } from "better-auth/plugins"
import type { BetterAuthPlugin } from "better-auth/types"
import { sql } from "drizzle-orm"

export function getAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.SESSION_CLAIMS_SECRET || ""

  if (!secret || secret.length < 32) {
    // During build, env vars may not be available.
    // Return a placeholder so module-level initialization succeeds.
    if (typeof process.env.NEXT_PHASE === "string") {
      return "build-phase-placeholder-secret-not-used-at-runtime!!"
    }
    throw new Error(
      "Missing BETTER_AUTH_SECRET (or SESSION_CLAIMS_SECRET) with at least 32 characters",
    )
  }

  return secret
}

function getTrustedOrigins(): string[] {
  const values = [
    process.env.BETTER_AUTH_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VOYANT_DASHBOARD_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.ADMIN_URL,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0)

  return Array.from(new Set(values.map((value) => value.trim().replace(/\/$/, ""))))
}

const LOCAL_WILDCARDS = [
  "http://localhost:*",
  "http://127.0.0.1:*",
  "https://localhost:*",
  "https://127.0.0.1:*",
]

function hasLocalOrigin(origins: string[], baseURL: string): boolean {
  const all = [...origins, baseURL]
  return all.some((value) => {
    try {
      const { hostname } = new URL(value)
      return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
    } catch {
      return false
    }
  })
}

/**
 * If the app is running against a localhost baseURL (dev), allow any localhost
 * origin/port so second dev servers (e.g. Vite on :3301 hitting API on :3200)
 * aren't rejected by Better Auth's origin check. Production origins are
 * unaffected — the wildcards are only added when we already see localhost.
 */
function expandTrustedOrigins(origins: string[], baseURL: string): string[] {
  if (!hasLocalOrigin(origins, baseURL)) return origins
  return Array.from(new Set([...origins, ...LOCAL_WILDCARDS]))
}

export interface CreateBetterAuthOptions {
  db?: ReturnType<typeof getDb>
  secret?: string
  baseURL?: string
  basePath?: string
  trustedOrigins?: string[]
  plugins?: BetterAuthPlugin[]
  /** Called when a user requests a password reset. If not provided, logs to console. */
  sendResetPassword?: (data: {
    user: { email: string; name: string }
    url: string
    token: string
  }) => Promise<void>
  /** Called to send a verification OTP. If not provided, logs to console. */
  sendVerificationOTP?: (data: { email: string; otp: string; type: string }) => Promise<void>
}

/**
 * Framework-agnostic Better Auth factory.
 *
 * Accepts optional overrides for db, secret, baseURL, trustedOrigins.
 * Does NOT depend on Next.js — safe to use in Hono workers, TanStack Start, etc.
 */
export function createBetterAuth(options: CreateBetterAuthOptions = {}) {
  const db = options.db ?? getDb("edge")
  const secret = options.secret ?? getAuthSecret()
  const baseURL =
    options.baseURL ??
    process.env.BETTER_AUTH_URL ??
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  const trustedOrigins = expandTrustedOrigins(
    options.trustedOrigins ?? getTrustedOrigins(),
    baseURL,
  )
  const extraPlugins = options.plugins ?? []

  return betterAuth({
    appName: "Voyant",
    baseURL,
    ...(options.basePath ? { basePath: options.basePath } : {}),
    secret,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: authUser,
        session: authSession,
        account: authAccount,
        verification: authVerification,
        apikey: apikeyTable,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      // eslint-disable-next-line @typescript-eslint/require-await
      sendResetPassword:
        options.sendResetPassword ??
        (async ({ user, url }) => {
          console.warn(
            `[Auth] No email provider configured — password reset for ${user.email}: ${url}`,
          )
        }),
    },
    emailVerification: {
      sendOnSignUp: false, // OTP plugin handles this
      autoSignInAfterVerification: true,
    },
    user: {
      changeEmail: {
        enabled: true,
      },
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      },
    },
    trustedOrigins,
    plugins: [
      apiKey({
        defaultPrefix: "voy_",
        apiKeyHeaders: ["authorization"],
        requireName: true,
        keyExpiration: {
          defaultExpiresIn: null,
        },
      }),
      emailOTP({
        // eslint-disable-next-line @typescript-eslint/require-await
        sendVerificationOTP:
          options.sendVerificationOTP ??
          (async ({ email, otp, type }) => {
            console.warn(`[Auth] OTP for ${email}: ${otp} (${type})`)
          }),
        otpLength: 6,
        expiresIn: 600,
        sendVerificationOnSignUp: true,
        changeEmail: {
          enabled: true,
        },
      }),
      ...extraPlugins,
    ],
    databaseHooks: {
      user: {
        create: {
          // Single-tenant: once a user exists, reject any new-user creation.
          // Covers email sign-up AND social-provider sign-up (Google would
          // otherwise auto-create a user on first OAuth callback). Existing
          // social sign-ins still work because this hook only fires on CREATE.
          // Seed scripts do raw drizzle inserts, so they bypass this hook —
          // which is intentional.
          before: async () => {
            const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(authUser)
            if ((row?.count ?? 0) > 0) {
              throw new Error("Sign-up is disabled. Ask an admin to invite you.")
            }
          },
          after: async (user) => {
            const nameParts = user.name?.split(" ") ?? []
            const firstName = nameParts[0] ?? null
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null

            // Single-tenant bootstrap: the very first user to register becomes
            // the super-admin. Runs atomically after the `user` row is
            // inserted, so a simple COUNT(*) = 1 check identifies them.
            const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(authUser)
            const isFirstUser = (countRow?.count ?? 0) === 1

            await db
              .insert(userProfilesTable)
              .values({
                id: user.id,
                firstName,
                lastName,
                avatarUrl: user.image ?? null,
                isSuperAdmin: isFirstUser,
              })
              .onConflictDoNothing()
          },
        },
      },
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
    },
  })
}

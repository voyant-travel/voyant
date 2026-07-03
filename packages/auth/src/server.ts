import { apiKey } from "@better-auth/api-key"
import { getDb } from "@voyant-travel/db"
import {
  apikeyTable,
  authAccount,
  authSession,
  authUser,
  authVerification,
} from "@voyant-travel/db/schema/iam"
import { type BetterAuthOptions, betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { emailOTP } from "better-auth/plugins"
import type { BetterAuthPlugin } from "better-auth/types"
import { sql } from "drizzle-orm"
import type { AnyPgTable } from "drizzle-orm/pg-core"

import { expandTrustedOrigins, getTrustedOrigins } from "./trusted-origins.js"
import { isFirstAuthUser, provisionCurrentUserProfile } from "./workspace.js"

export function getAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET || ""

  if (!secret || secret.length < 32) {
    throw new Error("Missing BETTER_AUTH_SECRET with at least 32 characters")
  }

  return secret
}

export type {
  AccountProfileUpdateHandler,
  ApiTokenRotationStore,
  BetterAuthApiTokenManagement,
  HandleAccountProfileRequestOptions,
  HandleApiTokenManagementRequestOptions,
  HandleOrganizationMembersRequestOptions,
  OrganizationMemberRecord,
  OrganizationMembersListHandler,
  OrganizationMembersListInput,
} from "./auth-facades.js"
export {
  handleAccountProfileRequest,
  handleApiTokenManagementRequest,
  handleOrganizationMembersRequest,
} from "./auth-facades.js"

type DefinedBetterAuthUserOptions<UserOptions extends BetterAuthOptions["user"]> =
  UserOptions extends undefined ? Record<PropertyKey, never> : NonNullable<UserOptions>

type ResolvedBetterAuthChangeEmail<UserOptions extends BetterAuthOptions["user"]> =
  DefinedBetterAuthUserOptions<UserOptions> extends { changeEmail?: infer ChangeEmail }
    ? ChangeEmail extends { enabled: infer Enabled }
      ? Omit<ChangeEmail, "enabled"> & { enabled: Enabled }
      : NonNullable<ChangeEmail> & { enabled: true }
    : { enabled: true }

type ResolvedBetterAuthUserOptions<UserOptions extends BetterAuthOptions["user"]> = Omit<
  DefinedBetterAuthUserOptions<UserOptions>,
  "changeEmail"
> & {
  changeEmail: ResolvedBetterAuthChangeEmail<UserOptions>
}

type VoyantBetterAuthPlugins = [ReturnType<typeof apiKey>, ReturnType<typeof emailOTP>]

type ResolvedBetterAuthPlugins<Plugins extends BetterAuthPlugin[] | undefined> =
  Plugins extends BetterAuthPlugin[]
    ? [...VoyantBetterAuthPlugins, ...Plugins]
    : VoyantBetterAuthPlugins

const DEFAULT_SIGNUP_BLOCK_SURFACES = ["admin"] as const
const CUSTOMER_SIGNUP_ENDPOINT_SUFFIXES = [
  "/sign-up/email",
  "/phone-number/verify",
  "/sign-in/email-otp",
] as const

export interface DisableSignupWhenUsersExistOptions {
  /**
   * Set to false when the consuming app owns all signup admission checks.
   *
   * Defaults to true.
   */
  enabled?: boolean
  /**
   * User surfaces that should keep the single-tenant signup guard. New users
   * with only other explicit surfaces can still be created by customer-facing
   * auth plugins such as phone OTP.
   *
   * Defaults to ["admin"]. Users without an explicit surfaces array are
   * treated as admin users for backward compatibility.
   */
  surfaces?: readonly string[]
}

type BetterAuthCreateBeforeResult =
  | boolean
  | undefined
  | {
      data: Record<string, unknown>
    }

type SignupBlockUserPayload = {
  surfaces?: unknown
}

type BetterAuthHookContext = {
  path?: string
}

function normalizeSignupBlockSurfaces(
  options: DisableSignupWhenUsersExistOptions | undefined,
): readonly string[] {
  return options?.surfaces ?? DEFAULT_SIGNUP_BLOCK_SURFACES
}

function isSignupBlockEnabled(options: DisableSignupWhenUsersExistOptions | undefined): boolean {
  return options?.enabled !== false
}

function normalizeSurfaceList(surfaces: readonly string[] | undefined): readonly string[] {
  if (!surfaces) return []

  const normalized = new Set<string>()
  for (const surface of surfaces) {
    const trimmed = surface.trim()
    if (trimmed.length > 0) {
      normalized.add(trimmed)
    }
  }
  return Array.from(normalized)
}

function signupBlockAppliesToUser(
  user: SignupBlockUserPayload | undefined,
  blockedSurfaces: readonly string[],
): boolean {
  if (blockedSurfaces.length === 0) return false

  const surfaces = user?.surfaces
  if (Array.isArray(surfaces)) {
    const explicitSurfaces = surfaces.filter(
      (surface): surface is string => typeof surface === "string" && surface.trim().length > 0,
    )
    if (explicitSurfaces.length > 0) {
      return explicitSurfaces.some((surface) => blockedSurfaces.includes(surface.trim()))
    }
  }

  if (typeof surfaces === "string" && surfaces.trim().length > 0) {
    return blockedSurfaces.includes(surfaces.trim())
  }

  return blockedSurfaces.includes("admin")
}

function isCustomerSignupCreate(context: BetterAuthHookContext | null | undefined): boolean {
  const path = context?.path
  if (!path) return false

  return CUSTOMER_SIGNUP_ENDPOINT_SUFFIXES.some((suffix) => path.endsWith(suffix))
}

function stampCustomerSignupSurfaces(
  user: SignupBlockUserPayload | undefined,
  context: BetterAuthHookContext | null | undefined,
  surfaces: readonly string[],
): SignupBlockUserPayload | undefined {
  if (surfaces.length === 0 || !isCustomerSignupCreate(context)) {
    return user
  }

  return {
    ...(user ?? {}),
    surfaces,
  }
}

type ResolvedCreateBetterAuthOptions<
  UserOptions extends BetterAuthOptions["user"],
  Plugins extends BetterAuthPlugin[] | undefined,
> = Omit<BetterAuthOptions, "plugins" | "user"> & {
  plugins: ResolvedBetterAuthPlugins<Plugins>
  user: ResolvedBetterAuthUserOptions<UserOptions>
}

export type BetterAuthDrizzleSchema = Record<string, AnyPgTable>

export interface CreateBetterAuthOptions<
  UserOptions extends BetterAuthOptions["user"] = BetterAuthOptions["user"],
  Plugins extends BetterAuthPlugin[] | undefined = BetterAuthPlugin[] | undefined,
> {
  db?: ReturnType<typeof getDb>
  secret?: string
  baseURL?: string
  basePath?: string
  trustedOrigins?: string[]
  /**
   * Additional Drizzle tables for Better Auth plugins. The consuming app owns
   * matching migrations for every table passed here.
   */
  extraSchema?: BetterAuthDrizzleSchema
  plugins?: Plugins
  user?: UserOptions
  /**
   * Surfaces stamped on Better Auth customer self-signups before the bundled
   * single-tenant signup guard evaluates the new user. Applies to Better
   * Auth OTP signup endpoints that create a user as part of verification.
   *
   * Leave undefined to preserve Better Auth's raw user payload.
   */
  customerSignupSurfaces?: readonly string[]
  disableSignupWhenUsersExist?: DisableSignupWhenUsersExistOptions
  /** Called when a user requests a password reset. If not provided, logs to console. */
  sendResetPassword?: (data: {
    user: { email: string; name: string }
    url: string
    token: string
  }) => Promise<void>
  /** Called to send a verification OTP. If not provided, logs to console. */
  sendVerificationOTP?: (data: { email: string; otp: string; type: string }) => Promise<void>
  /**
   * Better Auth session cookie cache: session data rides in a short-lived
   * signed cookie so `getSession` skips the Postgres lookup on most
   * requests. Enabled by default with a 5-minute TTL — the trade-off is
   * that a revoked/expired session can stay usable for up to `maxAge`
   * seconds. Pass `false` for revocation-sensitive deployments, or tune
   * `maxAge` (seconds).
   */
  sessionCookieCache?: false | { maxAge?: number }
  /** Better Auth secondary storage, typically Redis/KV, used for distributed rate limits. */
  secondaryStorage?: BetterAuthOptions["secondaryStorage"]
  /** Better Auth rate-limit config. Defaults to secondary storage when present. */
  rateLimit?: BetterAuthOptions["rateLimit"]
  /**
   * Controls Better Auth's Secure cookie flag. Defaults to secure except in
   * explicit local development (`NODE_ENV=development`).
   */
  useSecureCookies?: boolean
}

/**
 * Framework-agnostic Better Auth factory.
 *
 * Accepts optional overrides for db, secret, baseURL, trustedOrigins.
 * Does NOT depend on Next.js — safe to use in Hono workers, TanStack Start, etc.
 */
export function createBetterAuth<
  const UserOptions extends BetterAuthOptions["user"] = undefined,
  const Plugins extends BetterAuthPlugin[] | undefined = undefined,
>(options: CreateBetterAuthOptions<UserOptions, Plugins> = {}) {
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
  const signupBlockSurfaces = normalizeSignupBlockSurfaces(options.disableSignupWhenUsersExist)
  const signupBlockEnabled = isSignupBlockEnabled(options.disableSignupWhenUsersExist)
  const customerSignupSurfaces = normalizeSurfaceList(options.customerSignupSurfaces)
  const schema = {
    user: authUser,
    session: authSession,
    account: authAccount,
    verification: authVerification,
    apikey: apikeyTable,
    ...(options.extraSchema ?? {}),
  } satisfies BetterAuthDrizzleSchema
  const rateLimit =
    options.rateLimit ??
    (options.secondaryStorage
      ? ({
          enabled: true,
          window: 60,
          max: 100,
          storage: "secondary-storage",
        } as BetterAuthOptions["rateLimit"])
      : undefined)

  const authOptions = {
    appName: "Voyant",
    baseURL,
    ...(options.basePath ? { basePath: options.basePath } : {}),
    secret,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    ...(options.secondaryStorage ? { secondaryStorage: options.secondaryStorage } : {}),
    ...(rateLimit ? { rateLimit } : {}),
    ...(options.sessionCookieCache === false
      ? {}
      : {
          session: {
            cookieCache: {
              enabled: true,
              // Caps how long a revoked session stays usable from the
              // cookie alone; within the window getSession answers from
              // the signed cookie with zero DB roundtrips.
              maxAge: options.sessionCookieCache?.maxAge ?? 300,
            },
          },
        }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      // eslint-disable-next-line @typescript-eslint/require-await -- owner: auth; existing suppression is intentional pending typed cleanup.
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
      ...options.user,
      changeEmail: {
        enabled: true,
        ...options.user?.changeEmail,
      },
    } as ResolvedBetterAuthUserOptions<UserOptions>,
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
        // eslint-disable-next-line @typescript-eslint/require-await -- owner: auth; existing suppression is intentional pending typed cleanup.
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
    ] as ResolvedBetterAuthPlugins<Plugins>,
    databaseHooks: {
      user: {
        create: {
          // Single-tenant: once a user exists, reject any new-user creation.
          // Covers email sign-up AND social-provider sign-up (Google would
          // otherwise auto-create a user on first OAuth callback). Existing
          // social sign-ins still work because this hook only fires on CREATE.
          // Seed scripts do raw drizzle inserts, so they bypass this hook —
          // which is intentional.
          before: async (user, context): Promise<BetterAuthCreateBeforeResult> => {
            const normalizedUser = stampCustomerSignupSurfaces(
              user as SignupBlockUserPayload,
              context as BetterAuthHookContext | null,
              customerSignupSurfaces,
            )

            if (
              !signupBlockEnabled ||
              !signupBlockAppliesToUser(normalizedUser, signupBlockSurfaces)
            ) {
              if (normalizedUser === user) {
                return
              }
              return { data: normalizedUser as Record<string, unknown> }
            }

            const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(authUser)
            if ((row?.count ?? 0) > 0) {
              throw new Error("Sign-up is disabled. Ask an admin to invite you.")
            }

            if (normalizedUser !== user) {
              return { data: normalizedUser as Record<string, unknown> }
            }
          },
          after: async (user, context) => {
            if (
              customerSignupSurfaces.length > 0 &&
              isCustomerSignupCreate(context as BetterAuthHookContext | null)
            ) {
              return
            }

            // Single-tenant bootstrap: the very first user to register becomes
            // the super-admin. Runs atomically after the `user` row is
            // inserted, so a simple COUNT(*) = 1 check identifies them.
            await provisionCurrentUserProfile(db, {
              userId: user.id,
              name: user.name,
              image: user.image,
              isSuperAdmin: await isFirstAuthUser(db),
            })
          },
        },
      },
    },
    advanced: {
      useSecureCookies: options.useSecureCookies ?? process.env.NODE_ENV !== "development",
    },
  } as ResolvedCreateBetterAuthOptions<UserOptions, Plugins>

  return betterAuth<ResolvedCreateBetterAuthOptions<UserOptions, Plugins>>(authOptions)
}

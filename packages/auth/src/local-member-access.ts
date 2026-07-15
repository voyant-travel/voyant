import { authAccount, authSession, authUser } from "@voyant-travel/db/schema/iam"
import type { VoyantDb } from "@voyant-travel/hono"
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api"
import { deleteSessionCookie } from "better-auth/cookies"
import type { BetterAuthPlugin } from "better-auth/types"
import { and, eq } from "drizzle-orm"

import type { TeamMemberStatus } from "./team-management-runtime-port.js"

export const DEACTIVATED_PROVIDER_PREFIX = "voyant-deactivated:"

export function localProviderIdForStatus(providerId: string, status: TeamMemberStatus): string {
  if (status === "deactivated") {
    return providerId.startsWith(DEACTIVATED_PROVIDER_PREFIX)
      ? providerId
      : `${DEACTIVATED_PROVIDER_PREFIX}${providerId}`
  }
  return providerId.startsWith(DEACTIVATED_PROVIDER_PREFIX)
    ? providerId.slice(DEACTIVATED_PROVIDER_PREFIX.length)
    : providerId
}

export function isDeactivatedProviderId(providerId: string): boolean {
  return providerId.startsWith(DEACTIVATED_PROVIDER_PREFIX)
}

async function accountProvidersForUser(db: VoyantDb, userId: string): Promise<string[]> {
  const accounts = await db
    .select({ providerId: authAccount.providerId })
    .from(authAccount)
    .where(eq(authAccount.userId, userId))
  return accounts.map((account) => account.providerId)
}

export async function isLocalMemberDeactivated(db: VoyantDb, userId: string): Promise<boolean> {
  const providerIds = await accountProvidersForUser(db, userId)
  return providerIds.length > 0 && providerIds.every(isDeactivatedProviderId)
}

export async function isLocalMemberEmailDeactivated(db: VoyantDb, email: string): Promise<boolean> {
  const accounts = await db
    .select({ providerId: authAccount.providerId })
    .from(authAccount)
    .innerJoin(authUser, eq(authUser.id, authAccount.userId))
    .where(and(eq(authUser.email, email.trim().toLowerCase()), eq(authAccount.userId, authUser.id)))
  return (
    accounts.length > 0 && accounts.every((account) => isDeactivatedProviderId(account.providerId))
  )
}

export async function isLocalMemberSessionActive(
  db: VoyantDb,
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const sessions = await db
    .select({ id: authSession.id })
    .from(authSession)
    .where(and(eq(authSession.id, sessionId), eq(authSession.userId, userId)))
    .limit(1)
  return sessions.length > 0
}

export interface LocalMemberAccessResolver {
  isEmailDeactivated(email: string): Promise<boolean>
  isSessionActive(sessionId: string, userId: string): Promise<boolean>
  isUserDeactivated(userId: string): Promise<boolean>
}

const ACCESS_DENIED_MESSAGE = "This account is deactivated."

function requestEmail(context: { path?: string; body?: unknown; query?: unknown }): string | null {
  const path = context.path ?? ""
  if (!path.includes("email-otp") && !path.includes("email") && !path.includes("password")) {
    return null
  }

  for (const input of [context.body, context.query]) {
    if (!input || typeof input !== "object") continue
    const email = (input as Record<string, unknown>).email
    if (typeof email === "string" && email.trim().length > 0) {
      return email.trim().toLowerCase()
    }
  }
  return null
}

function denyAccess(): never {
  throw new APIError("FORBIDDEN", { message: ACCESS_DENIED_MESSAGE })
}

export function createLocalMemberAccessPlugin(
  resolver: LocalMemberAccessResolver,
): BetterAuthPlugin {
  return {
    id: "voyant-local-member-access",
    init() {
      return {
        options: {
          databaseHooks: {
            account: {
              create: {
                before: async (account) => {
                  if (await resolver.isUserDeactivated(account.userId)) denyAccess()
                },
              },
            },
            session: {
              create: {
                before: async (session) => {
                  if (await resolver.isUserDeactivated(session.userId)) denyAccess()
                },
              },
            },
          },
        },
      }
    },
    hooks: {
      before: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async (context) => {
            const session = await getSessionFromCtx(context)
            if (session) {
              const [isDeactivated, isSessionActive] = await Promise.all([
                resolver.isUserDeactivated(session.user.id),
                resolver.isSessionActive(session.session.id, session.user.id),
              ])
              if (isDeactivated || !isSessionActive) {
                deleteSessionCookie(context)
                if (context.path === "/get-session") return context.json(null)
                denyAccess()
              }
            }

            const email = requestEmail(context)
            if (email && (await resolver.isEmailDeactivated(email))) denyAccess()
          }),
        },
      ],
    },
  }
}

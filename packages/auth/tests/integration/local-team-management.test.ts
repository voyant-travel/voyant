import { createDbClient } from "@voyant-travel/db"
import { authAccount, authUser, userProfilesTable } from "@voyant-travel/db/schema/iam"
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { createBetterAuth } from "../../src/server.js"
import { createLocalTeamManagementAdapter } from "../../src/team-management-local-adapter.js"
import type { TeamManagementRequestContext } from "../../src/team-management-runtime-port.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const BASE_URL = "http://localhost:3000"
const PASSWORD = "p".repeat(16)

function request(path: string, body?: Record<string, unknown>, cookie?: string): Request {
  return new Request(`${BASE_URL}/api/auth${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0])
    .join("; ")
}

describe.skipIf(!TEST_DATABASE_URL)("local team management integration", () => {
  const db = createDbClient(TEST_DATABASE_URL!, {
    adapter: "node",
    nodeMaxConnections: 4,
    timeouts: { connectMs: false, queryMs: false, statementMs: false },
  })
  const adapter = createLocalTeamManagementAdapter({
    resolveDeployment() {
      return {
        appUrl: "https://operator.example.com",
        authMode: "local",
        cloudAdminMembers: null,
      }
    },
    async sendInvitationEmail() {
      return true
    },
  })

  function context(userId: string): TeamManagementRequestContext {
    return { bindings: {}, db, userId }
  }

  async function insertOwner(id: string, email: string) {
    const now = new Date()
    await db.insert(authUser).values({
      id,
      name: email,
      email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(userProfilesTable).values({ id, isSuperAdmin: true, permissions: ["*"] })
    await db.insert(authAccount).values({
      id: `account-${id}`,
      accountId: id,
      providerId: "credential",
      userId: id,
      createdAt: now,
      updatedAt: now,
    })
  }

  beforeEach(async () => {
    await db.delete(authUser)
  })

  afterAll(async () => {
    await db.$client.end({ timeout: 0 })
  })

  it("atomically preserves an active owner during concurrent demote and deactivate", async () => {
    await insertOwner("owner-a", "owner-a@example.com")
    await insertOwner("owner-b", "owner-b@example.com")

    const results = await Promise.allSettled([
      adapter.updateMemberRole(context("owner-b"), "owner-a", "admin"),
      adapter.deactivateMember(context("owner-a"), "owner-b"),
    ])

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "last_owner" },
    })

    const profiles = await db
      .select({ id: userProfilesTable.id, isSuperAdmin: userProfilesTable.isSuperAdmin })
      .from(userProfilesTable)
    const accounts = await db
      .select({ userId: authAccount.userId, providerId: authAccount.providerId })
      .from(authAccount)
    const activeUserIds = new Set(
      accounts
        .filter((account) => !account.providerId.startsWith("voyant-deactivated:"))
        .map((account) => account.userId),
    )
    const activeOwners = profiles.filter(
      (profile) => profile.isSuperAdmin && activeUserIds.has(profile.id),
    )

    expect(activeOwners).toHaveLength(1)
    expect(
      await db
        .select({ id: authUser.id })
        .from(authUser)
        .where(eq(authUser.id, activeOwners[0]!.id)),
    ).toHaveLength(1)
  })

  it("drives session, password, and OTP access from durable local deactivation state", async () => {
    await insertOwner("owner", "owner@example.com")
    const sentOtps: string[] = []
    const auth = createBetterAuth({
      baseURL: BASE_URL,
      db,
      disableSignupWhenUsersExist: { enabled: false },
      secret: "x".repeat(32),
      sendVerificationOTP: async ({ otp }) => {
        sentOtps.push(otp)
      },
    })
    const signup = await auth.handler(
      request("/sign-up/email", {
        email: "member@example.com",
        name: "Member",
        password: PASSWORD,
      }),
    )
    expect(signup.status).toBe(200)
    const signupBody = (await signup.json()) as { user: { id: string } }
    const memberId = signupBody.user.id
    await db.update(authUser).set({ emailVerified: true }).where(eq(authUser.id, memberId))
    const activePassword = await auth.handler(
      request("/sign-in/email", { email: "member@example.com", password: PASSWORD }),
    )
    expect(activePassword.status).toBe(200)
    const cookie = cookieHeader(activePassword)
    sentOtps.length = 0

    await adapter.deactivateMember(context("owner"), memberId)

    const deniedSession = await auth.handler(request("/get-session", undefined, cookie))
    expect(deniedSession.status).toBe(200)
    expect(await deniedSession.json()).toBeNull()

    const deniedPassword = await auth.handler(
      request("/sign-in/email", { email: "member@example.com", password: PASSWORD }),
    )
    expect(deniedPassword.status).toBe(403)

    const deniedOtp = await auth.handler(
      request("/email-otp/send-verification-otp", {
        email: "member@example.com",
        type: "sign-in",
      }),
    )
    expect(deniedOtp.status).toBe(403)
    expect(sentOtps).toHaveLength(0)

    await adapter.activateMember(context("owner"), memberId)

    const deniedReactivatedSession = await auth.handler(request("/get-session", undefined, cookie))
    expect(deniedReactivatedSession.status).toBe(200)
    expect(await deniedReactivatedSession.json()).toBeNull()

    const restoredPassword = await auth.handler(
      request("/sign-in/email", { email: "member@example.com", password: PASSWORD }),
    )
    expect(restoredPassword.status).toBe(200)

    const restoredOtp = await auth.handler(
      request("/email-otp/send-verification-otp", {
        email: "member@example.com",
        type: "sign-in",
      }),
    )
    expect(restoredOtp.status).toBe(200)
    expect(sentOtps).toHaveLength(1)
  })
})

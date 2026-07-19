import { createDbClient } from "@voyant-travel/db"
import {
  customerAuthInvitation,
  customerAuthMember,
  customerAuthOrganization,
  customerAuthUser,
} from "@voyant-travel/db/schema/iam"
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { materializeCustomerBusinessAccount } from "../../src/customer-business-onboarding-service.js"
import { createOperatorAuthNodeRuntime } from "../../src/node-runtime.js"
import { createCustomerBetterAuth } from "../../src/server.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const baseURL = "http://customer-auth.integration.test"
const basePath = "/auth/customer"

describe.skipIf(!TEST_DATABASE_URL)("customer business Better Auth compatibility", () => {
  const db = createDbClient(TEST_DATABASE_URL!, {
    adapter: "node",
    nodeMaxConnections: 4,
    timeouts: { connectMs: false, queryMs: false, statementMs: false },
  })
  const otpByEmail = new Map<string, string>()
  const invitationIds: string[] = []
  const auth = createCustomerBetterAuth({
    db,
    secret: "customer-business-integration-secret-32-chars",
    baseURL,
    basePath,
    trustedOrigins: [baseURL],
    methods: { emailCode: true, emailPassword: false },
    accountPolicy: {
      allowedKinds: ["business"],
      personalSignup: "disabled",
      businessOnboarding: "invite-only",
    },
    sendVerificationOTP: async ({ email, otp }) => {
      otpByEmail.set(email, otp)
    },
    sendOrganizationInvitation: async ({ id }) => {
      invitationIds.push(id)
    },
    advanced: { useSecureCookies: false },
  })

  beforeEach(async () => {
    invitationIds.length = 0
    otpByEmail.clear()
    await db.delete(customerAuthOrganization)
    await db.delete(customerAuthUser)
  })

  afterAll(async () => {
    await db.$client.end({ timeout: 0 })
  })

  async function request(path: string, body?: unknown, cookie?: string) {
    return auth.handler(
      new Request(`${baseURL}${basePath}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(cookie ? { cookie } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    )
  }

  function cookieFrom(response: Response): string {
    return response.headers
      .getSetCookie()
      .map((value) => value.split(";", 1)[0])
      .join("; ")
  }

  async function signIn(email: string, name: string) {
    const sent = await request("/email-otp/send-verification-otp", {
      email,
      type: "sign-in",
    })
    expect(sent.status).toBe(200)
    const otp = otpByEmail.get(email)
    expect(otp).toBeTruthy()
    const signedIn = await request("/sign-in/email-otp", { email, otp, name })
    expect(signedIn.status).toBe(200)
    const payload = (await signedIn.json()) as { user: { id: string } }
    return { cookie: cookieFrom(signedIn), userId: payload.user.id }
  }

  it("materializes a mapped owner and remains compatible with list/get/set-active/invite/accept", async () => {
    const owner = await signIn("owner@example.com", "Owner")
    const recipient = await signIn("recipient@example.com", "Recipient")
    const wrongRecipient = await signIn("wrong@example.com", "Wrong")
    const account = await materializeCustomerBusinessAccount(db, {
      ownerUserId: owner.userId,
      name: "Acme Corporate Travel",
      relationshipOrganizationId: "organizations_test_acme",
    })
    expect(account.membershipRole).toBe("owner")

    const listed = await request("/organization/list", undefined, owner.cookie)
    expect(listed.status).toBe(200)
    expect(await listed.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: account.authOrganizationId,
          relationshipOrganizationId: "organizations_test_acme",
        }),
      ]),
    )
    const full = await request(
      `/organization/get-full-organization?organizationId=${account.authOrganizationId}`,
      undefined,
      owner.cookie,
    )
    expect(full.status).toBe(200)

    const activated = await request(
      "/organization/set-active",
      { organizationId: account.authOrganizationId },
      owner.cookie,
    )
    expect(activated.status).toBe(200)

    const invited = await request(
      "/organization/invite-member",
      {
        email: "recipient@example.com",
        role: "member",
        organizationId: account.authOrganizationId,
      },
      owner.cookie,
    )
    expect(invited.status).toBe(200)
    const invitationId = invitationIds.at(-1)
    expect(invitationId).toBeTruthy()

    const wrong = await request(
      "/organization/accept-invitation",
      { invitationId },
      wrongRecipient.cookie,
    )
    expect(wrong.status).toBe(403)

    const accepted = await request(
      "/organization/accept-invitation",
      { invitationId },
      recipient.cookie,
    )
    expect(accepted.status).toBe(200)
    expect(await accepted.json()).toMatchObject({
      invitation: { id: invitationId, organizationId: account.authOrganizationId },
      member: {
        userId: recipient.userId,
        organizationId: account.authOrganizationId,
        role: "member",
      },
    })
    const [membership] = await db
      .select()
      .from(customerAuthMember)
      .where(eq(customerAuthMember.organizationId, account.authOrganizationId))
    expect(membership).toBeTruthy()
  })

  it("allows only one concurrent acceptance and rejects expired invitations", async () => {
    const owner = await signIn("race-owner@example.com", "Race Owner")
    const recipient = await signIn("race-recipient@example.com", "Race Recipient")
    const expiredRecipient = await signIn("expired@example.com", "Expired")
    const account = await materializeCustomerBusinessAccount(db, {
      ownerUserId: owner.userId,
      name: "Race Travel",
      relationshipOrganizationId: "organizations_test_race",
    })
    await request(
      "/organization/invite-member",
      {
        email: "race-recipient@example.com",
        role: "admin",
        organizationId: account.authOrganizationId,
      },
      owner.cookie,
    )
    const raceInvitationId = invitationIds.at(-1)!
    const results = await Promise.all([
      request(
        "/organization/accept-invitation",
        { invitationId: raceInvitationId },
        recipient.cookie,
      ),
      request(
        "/organization/accept-invitation",
        { invitationId: raceInvitationId },
        recipient.cookie,
      ),
    ])
    expect(results.map(({ status }) => status).filter((status) => status === 200)).toHaveLength(1)

    await request(
      "/organization/invite-member",
      {
        email: "expired@example.com",
        role: "member",
        organizationId: account.authOrganizationId,
      },
      owner.cookie,
    )
    const expiredInvitationId = invitationIds.at(-1)!
    await db
      .update(customerAuthInvitation)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(customerAuthInvitation.id, expiredInvitationId))
    const expired = await request(
      "/organization/accept-invitation",
      { invitationId: expiredInvitationId },
      expiredRecipient.cookie,
    )
    expect(expired.status).toBe(400)
  })

  it("accepts through the Voyant facade, explicitly activates, and returns refreshed cookies", async () => {
    let invitationId: string | undefined
    const runtime = createOperatorAuthNodeRuntime({
      accessCatalog: { resources: [], presets: [] },
      appName: "customer-business-integration",
      authMode: "local",
      reporter: { captureException: () => {} },
      openDatabase: () => ({ db, dispose: async () => {} }),
      resolveCustomerAuthContext: async () => ({
        baseURL,
        publicApiBaseURL: `${baseURL}/v1`,
        invitationAcceptBaseURL: baseURL,
        trustedOrigins: [baseURL],
        methods: { emailCode: true, emailPassword: false },
        accountPolicy: {
          allowedKinds: ["business"],
          personalSignup: "disabled",
          businessOnboarding: "invite-only",
        },
      }),
      resolveEmailSender: () => ({
        sendResetPassword: async () => {},
        sendVerificationOtp: async ({ email, otp }) => {
          otpByEmail.set(email, otp)
        },
        sendCustomerOrganizationInvitation: async ({ url }) => {
          invitationId = new URL(url).pathname.split("/").at(-1)
        },
      }),
    })
    const env = {
      DATABASE_URL: TEST_DATABASE_URL!,
      BETTER_AUTH_ADMIN_SECRET: "admin-business-integration-secret-32-chars",
      BETTER_AUTH_CUSTOMER_SECRET: "customer-business-integration-secret-32-chars",
      SESSION_CLAIMS_ADMIN_SECRET: "admin-claims-business-integration-32-chars",
      SESSION_CLAIMS_CUSTOMER_SECRET: "customer-claims-business-integration-32-chars",
    }
    const runtimeRequest = (path: string, body?: unknown, cookie?: string) =>
      runtime.handler.fetch(
        new Request(`${baseURL}${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            ...(body === undefined ? {} : { "content-type": "application/json" }),
            ...(cookie ? { cookie } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
        env,
        { waitUntil: () => {} } as never,
      )
    const runtimeSignIn = async (email: string, name: string) => {
      expect(
        (
          await runtimeRequest("/auth/customer/email-otp/send-verification-otp", {
            email,
            type: "sign-in",
          })
        ).status,
      ).toBe(200)
      const signedIn = await runtimeRequest("/auth/customer/sign-in/email-otp", {
        email,
        otp: otpByEmail.get(email),
        name,
      })
      expect(signedIn.status).toBe(200)
      const payload = (await signedIn.clone().json()) as { user: { id: string } }
      return { cookie: cookieFrom(signedIn), userId: payload.user.id }
    }

    const owner = await runtimeSignIn("facade-owner@example.com", "Facade Owner")
    const recipient = await runtimeSignIn("facade-recipient@example.com", "Facade Recipient")
    const account = await materializeCustomerBusinessAccount(db, {
      ownerUserId: owner.userId,
      name: "Facade Corporate",
      relationshipOrganizationId: "organizations_test_facade",
    })
    const invited = await runtimeRequest(
      "/auth/customer/organization/invite-member",
      {
        email: "facade-recipient@example.com",
        role: "member",
        organizationId: account.authOrganizationId,
      },
      owner.cookie,
    )
    expect(invited.status).toBe(200)
    expect(invitationId).toBeTruthy()

    const accepted = await runtimeRequest(
      "/auth/customer/business-account-invitations/accept",
      { invitationId },
      recipient.cookie,
    )
    expect(accepted.status).toBe(200)
    expect(await accepted.clone().json()).toEqual({
      account: expect.objectContaining({
        kind: "business",
        authOrganizationId: account.authOrganizationId,
        membershipRole: "member",
      }),
    })
    expect(accepted.headers.getSetCookie().length).toBeGreaterThan(0)

    const refreshedCookie = cookieFrom(accepted)
    const accounts = await runtimeRequest(
      "/auth/customer/buyer-accounts",
      undefined,
      refreshedCookie,
    )
    expect(accounts.status).toBe(200)
    expect(await accounts.json()).toMatchObject({
      activeAccount: { authOrganizationId: account.authOrganizationId },
    })
  })
})

import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { emailOTP } from "better-auth/plugins"
import { describe, expect, it, vi } from "vitest"

import { createLocalMemberAccessPlugin } from "../../src/local-member-access.js"

const BASE_URL = "http://localhost:3000"
const PASSWORD = "p".repeat(16)
const SECRET = "x".repeat(32)

function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0])
    .join("; ")
}

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

function authFixture() {
  const deactivatedUserIds = new Set<string>()
  const deactivatedEmails = new Set<string>()
  const revokedSessionIds = new Set<string>()
  const sentOtps = new Map<string, string>()
  const sendVerificationOTP = vi.fn(
    async ({ email, otp }: { email: string; otp: string; type: string }) => {
      sentOtps.set(email, otp)
    },
  )
  const auth = betterAuth({
    baseURL: BASE_URL,
    secret: SECRET,
    database: memoryAdapter({ account: [], session: [], user: [], verification: [] }),
    emailAndPassword: { enabled: true },
    session: { cookieCache: { enabled: true, maxAge: 300 } },
    plugins: [
      emailOTP({ sendVerificationOTP }),
      createLocalMemberAccessPlugin({
        isEmailDeactivated: async (email) => deactivatedEmails.has(email),
        isSessionActive: async (sessionId) => !revokedSessionIds.has(sessionId),
        isUserDeactivated: async (userId) => deactivatedUserIds.has(userId),
      }),
    ],
  })

  return {
    auth,
    deactivate(user: { id: string; email: string }) {
      deactivatedUserIds.add(user.id)
      deactivatedEmails.add(user.email)
    },
    reactivate(user: { id: string; email: string }) {
      deactivatedUserIds.delete(user.id)
      deactivatedEmails.delete(user.email)
    },
    revokeSession(sessionId: string) {
      revokedSessionIds.add(sessionId)
    },
    sendVerificationOTP,
    sentOtps,
  }
}

async function signUp(
  auth: ReturnType<typeof authFixture>["auth"],
  email: string,
): Promise<{ cookie: string; user: { id: string; email: string } }> {
  const response = await auth.handler(
    request("/sign-up/email", {
      email,
      name: "Team Member",
      password: PASSWORD,
    }),
  )
  expect(response.status).toBe(200)
  const body = (await response.json()) as { user: { id: string; email: string } }
  return { cookie: cookieHeader(response), user: body.user }
}

describe("local member access Better Auth pipeline", () => {
  it("denies cached sessions and password sign-in until the member is reactivated", async () => {
    const fixture = authFixture()
    const member = await signUp(fixture.auth, "member@example.com")

    const activeSession = await fixture.auth.handler(
      request("/get-session", undefined, member.cookie),
    )
    const activeSessionBody = (await activeSession.json()) as {
      session: { id: string }
      user: { id: string }
    }
    expect(activeSessionBody).toMatchObject({ user: { id: member.user.id } })

    fixture.deactivate(member.user)
    fixture.revokeSession(activeSessionBody.session.id)

    const deniedCachedSession = await fixture.auth.handler(
      request("/get-session", undefined, member.cookie),
    )
    expect(deniedCachedSession.status).toBe(200)
    expect(await deniedCachedSession.json()).toBeNull()

    const deniedSignIn = await fixture.auth.handler(
      request("/sign-in/email", {
        email: member.user.email,
        password: PASSWORD,
      }),
    )
    expect(deniedSignIn.status).toBe(403)

    fixture.reactivate(member.user)

    const deniedReactivatedCachedSession = await fixture.auth.handler(
      request("/get-session", undefined, member.cookie),
    )
    expect(deniedReactivatedCachedSession.status).toBe(200)
    expect(await deniedReactivatedCachedSession.json()).toBeNull()

    const restoredSignIn = await fixture.auth.handler(
      request("/sign-in/email", {
        email: member.user.email,
        password: PASSWORD,
      }),
    )
    expect(restoredSignIn.status).toBe(200)
    expect(await restoredSignIn.json()).toMatchObject({ user: { id: member.user.id } })
  })

  it("denies OTP issuance and OTP sign-in until the member is reactivated", async () => {
    const fixture = authFixture()
    const member = await signUp(fixture.auth, "otp-member@example.com")

    const issuedBeforeDeactivation = await fixture.auth.handler(
      request("/email-otp/send-verification-otp", {
        email: member.user.email,
        type: "sign-in",
      }),
    )
    expect(issuedBeforeDeactivation.status).toBe(200)
    const preDeactivationOtp = fixture.sentOtps.get(member.user.email)
    expect(preDeactivationOtp).toBeDefined()

    fixture.deactivate(member.user)

    const deniedPreIssuedOtp = await fixture.auth.handler(
      request("/sign-in/email-otp", {
        email: member.user.email,
        otp: preDeactivationOtp,
      }),
    )
    expect(deniedPreIssuedOtp.status).toBe(403)

    const deniedOtp = await fixture.auth.handler(
      request("/email-otp/send-verification-otp", {
        email: member.user.email,
        type: "sign-in",
      }),
    )
    expect(deniedOtp.status).toBe(403)
    expect(fixture.sendVerificationOTP).toHaveBeenCalledTimes(1)

    fixture.reactivate(member.user)

    const issuedOtp = await fixture.auth.handler(
      request("/email-otp/send-verification-otp", {
        email: member.user.email,
        type: "sign-in",
      }),
    )
    expect(issuedOtp.status).toBe(200)

    const otp = fixture.sentOtps.get(member.user.email)
    expect(otp).toBeDefined()

    const restoredOtpSignIn = await fixture.auth.handler(
      request("/sign-in/email-otp", {
        email: member.user.email,
        otp,
      }),
    )
    expect(restoredOtpSignIn.status).toBe(200)
    expect(await restoredOtpSignIn.json()).toMatchObject({ user: { id: member.user.id } })
  })
})

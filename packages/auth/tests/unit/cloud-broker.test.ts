import { describe, expect, it } from "vitest"

import {
  createCloudAdminAuthStart,
  normalizeCloudAdminAuthNext,
  VOYANT_CLOUD_ADMIN_AUTH_STATE_COOKIE,
  verifyCloudAdminAuthCallback,
} from "../../src/cloud-broker.js"

const secret = "test-cloud-auth-cookie-secret-with-more-than-32-chars"

describe("cloud broker auth state", () => {
  it("builds a Cloud start redirect bound to deployment, callback, state, and nonce", async () => {
    const result = await createCloudAdminAuthStart({
      requestUrl: "https://admin.example.com/api/auth/cloud/start?next=/settings/team",
      next: "/settings/team",
      randomState: "state_123",
      randomNonce: "nonce_123",
      now: new Date("2026-05-16T00:00:00.000Z"),
      config: {
        cloudAuthStartUrl: "https://dash.voyantcloud.com/admin-auth/start",
        deploymentId: "dep_123",
        adminCallbackUrl: "https://admin.example.com/api/auth/cloud/callback",
        appId: "app_123",
        environment: "production",
        cookieSecret: secret,
      },
    })

    const redirectUrl = new URL(result.redirectUrl)
    expect(redirectUrl.origin).toBe("https://dash.voyantcloud.com")
    expect(redirectUrl.pathname).toBe("/admin-auth/start")
    expect(redirectUrl.searchParams.get("deployment_id")).toBe("dep_123")
    expect(redirectUrl.searchParams.get("redirect_uri")).toBe(
      "https://admin.example.com/api/auth/cloud/callback",
    )
    expect(redirectUrl.searchParams.get("state")).toBe("state_123")
    expect(redirectUrl.searchParams.get("nonce")).toBe("nonce_123")
    expect(redirectUrl.searchParams.get("surface")).toBe("admin")
    expect(redirectUrl.searchParams.get("next")).toBe("/settings/team")
    expect(redirectUrl.searchParams.get("app_id")).toBe("app_123")
    expect(redirectUrl.searchParams.get("environment")).toBe("production")
    expect(result.setCookie).toContain(`${VOYANT_CLOUD_ADMIN_AUTH_STATE_COOKIE}=`)
    expect(result.setCookie).toContain("HttpOnly")
    expect(result.setCookie).toContain("Secure")
    expect(result.setCookie).toContain("Path=/api/auth/cloud")
    expect(result.setCookie).toContain("SameSite=Lax")
  })

  it("verifies matching callback state and code", async () => {
    const start = await createCloudAdminAuthStart({
      requestUrl: "http://localhost:3300/api/auth/cloud/start",
      randomState: "state_123",
      randomNonce: "nonce_123",
      now: new Date("2026-05-16T00:00:00.000Z"),
      config: {
        cloudAuthStartUrl: "http://localhost:3000/admin-auth/start",
        deploymentId: "dep_123",
        adminCallbackUrl: "http://localhost:3300/api/auth/cloud/callback",
        cookieSecret: secret,
      },
    })
    const cookie = start.setCookie.split(";")[0]

    const result = await verifyCloudAdminAuthCallback({
      requestUrl: "http://localhost:3300/api/auth/cloud/callback?code=code_123&state=state_123",
      cookieHeader: cookie,
      cookieSecret: secret,
      now: new Date("2026-05-16T00:01:00.000Z"),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.code).toBe("code_123")
    expect(result.state.deploymentId).toBe("dep_123")
    expect(result.state.nonce).toBe("nonce_123")
    expect(result.clearCookie).toContain("Max-Age=0")
    expect(result.clearCookie).toContain("Path=/api/auth/cloud")
  })

  it("rejects mismatched or expired callback state", async () => {
    const start = await createCloudAdminAuthStart({
      requestUrl: "http://localhost:3300/api/auth/cloud/start",
      randomState: "state_123",
      randomNonce: "nonce_123",
      now: new Date("2026-05-16T00:00:00.000Z"),
      config: {
        cloudAuthStartUrl: "http://localhost:3000/admin-auth/start",
        deploymentId: "dep_123",
        adminCallbackUrl: "http://localhost:3300/api/auth/cloud/callback",
        cookieSecret: secret,
        stateTtlSeconds: 60,
      },
    })
    const cookie = start.setCookie.split(";")[0]

    await expect(
      verifyCloudAdminAuthCallback({
        requestUrl: "http://localhost:3300/api/auth/cloud/callback?code=code_123&state=wrong",
        cookieHeader: cookie,
        cookieSecret: secret,
        now: new Date("2026-05-16T00:00:30.000Z"),
      }),
    ).resolves.toMatchObject({ ok: false, error: "invalid_state" })

    await expect(
      verifyCloudAdminAuthCallback({
        requestUrl: "http://localhost:3300/api/auth/cloud/callback?code=code_123&state=state_123",
        cookieHeader: cookie,
        cookieSecret: secret,
        now: new Date("2026-05-16T00:02:00.000Z"),
      }),
    ).resolves.toMatchObject({ ok: false, error: "expired_state" })
  })
})

describe("normalizeCloudAdminAuthNext", () => {
  it("keeps same-origin destinations and rejects external redirects", () => {
    expect(normalizeCloudAdminAuthNext("/settings/team", "https://admin.example.com")).toBe(
      "/settings/team",
    )
    expect(
      normalizeCloudAdminAuthNext(
        "https://admin.example.com/settings/team?tab=members",
        "https://admin.example.com",
      ),
    ).toBe("/settings/team?tab=members")
    expect(
      normalizeCloudAdminAuthNext("https://evil.example.com", "https://admin.example.com"),
    ).toBe("/")
    expect(normalizeCloudAdminAuthNext("//evil.example.com", "https://admin.example.com")).toBe("/")
  })
})

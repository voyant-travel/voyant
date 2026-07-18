import { describe, expect, it } from "vitest"

import {
  createCloudAdminAuthStart,
  exchangeCloudAdminAuthCode,
  normalizeCloudAdminAuthNext,
  revalidateCloudAdminAuthAccess,
  VOYANT_CLOUD_ADMIN_ASSERTION_ISSUER,
  VOYANT_CLOUD_ADMIN_AUTH_STATE_COOKIE,
  verifyCloudAdminAuthCallback,
} from "../../src/cloud-broker.js"

const secret = "test-cloud-auth-cookie-secret-with-more-than-32-chars"

describe("cloud broker auth state", () => {
  it("builds a Cloud start redirect bound to deployment, callback, state, and nonce", async () => {
    const result = await createCloudAdminAuthStart({
      requestUrl: "http://operator-internal:3300/api/auth/admin/cloud/start?next=/settings/team",
      next: "/settings/team",
      randomState: "state_123",
      randomNonce: "nonce_123",
      now: new Date("2026-05-16T00:00:00.000Z"),
      config: {
        cloudAuthStartUrl: "https://dash.voyantcloud.com/admin-auth/start",
        deploymentId: "dep_123",
        adminCallbackUrl: "https://admin.example.com/api/auth/admin/cloud/callback",
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
      "https://admin.example.com/api/auth/admin/cloud/callback",
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
    expect(result.setCookie).toContain("Path=/api/auth/admin/cloud")
    expect(result.setCookie).toContain("SameSite=Lax")
  })

  it("keeps the clear cookie Secure behind TLS termination", async () => {
    const start = await createCloudAdminAuthStart({
      requestUrl: "http://operator-internal:3300/api/auth/admin/cloud/start",
      randomState: "state_123",
      randomNonce: "nonce_123",
      config: {
        cloudAuthStartUrl: "https://dash.voyantcloud.com/admin-auth/start",
        deploymentId: "dep_123",
        adminCallbackUrl: "https://admin.example.com/api/auth/admin/cloud/callback",
        cookieSecret: secret,
      },
    })

    const result = await verifyCloudAdminAuthCallback({
      requestUrl:
        "http://operator-internal:3300/api/auth/admin/cloud/callback?code=code_123&state=state_123",
      cookieHeader: start.setCookie.split(";")[0],
      cookieSecret: secret,
      secureCookie: true,
    })

    expect(result.clearCookie).toContain("Secure")
  })

  it("verifies matching callback state and code", async () => {
    const start = await createCloudAdminAuthStart({
      requestUrl: "http://localhost:3300/api/auth/admin/cloud/start",
      randomState: "state_123",
      randomNonce: "nonce_123",
      now: new Date("2026-05-16T00:00:00.000Z"),
      config: {
        cloudAuthStartUrl: "http://localhost:3000/admin-auth/start",
        deploymentId: "dep_123",
        adminCallbackUrl: "http://localhost:3300/api/auth/admin/cloud/callback",
        cookieSecret: secret,
      },
    })
    const cookie = start.setCookie.split(";")[0]

    const result = await verifyCloudAdminAuthCallback({
      requestUrl:
        "http://localhost:3300/api/auth/admin/cloud/callback?code=code_123&state=state_123",
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
    expect(result.clearCookie).toContain("Path=/api/auth/admin/cloud")
  })

  it("rejects mismatched or expired callback state", async () => {
    const start = await createCloudAdminAuthStart({
      requestUrl: "http://localhost:3300/api/auth/admin/cloud/start",
      randomState: "state_123",
      randomNonce: "nonce_123",
      now: new Date("2026-05-16T00:00:00.000Z"),
      config: {
        cloudAuthStartUrl: "http://localhost:3000/admin-auth/start",
        deploymentId: "dep_123",
        adminCallbackUrl: "http://localhost:3300/api/auth/admin/cloud/callback",
        cookieSecret: secret,
        stateTtlSeconds: 60,
      },
    })
    const cookie = start.setCookie.split(";")[0]

    await expect(
      verifyCloudAdminAuthCallback({
        requestUrl: "http://localhost:3300/api/auth/admin/cloud/callback?code=code_123&state=wrong",
        cookieHeader: cookie,
        cookieSecret: secret,
        now: new Date("2026-05-16T00:00:30.000Z"),
      }),
    ).resolves.toMatchObject({ ok: false, error: "invalid_state" })

    await expect(
      verifyCloudAdminAuthCallback({
        requestUrl:
          "http://localhost:3300/api/auth/admin/cloud/callback?code=code_123&state=state_123",
        cookieHeader: cookie,
        cookieSecret: secret,
        now: new Date("2026-05-16T00:02:00.000Z"),
      }),
    ).resolves.toMatchObject({ ok: false, error: "expired_state" })
  })
})

describe("revalidateCloudAdminAuthAccess", () => {
  it("posts deployment credentials and WorkOS user id to Cloud", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = []
    const fetch = async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ url: url.toString(), init })
      return Response.json({ ok: true, status: "active" })
    }

    const result = await revalidateCloudAdminAuthAccess({
      workosUserId: "user_workos_123",
      fetch: fetch as typeof globalThis.fetch,
      config: {
        revalidateUrl: "https://api.voyant.travel/cloud/v1/admin-auth/revalidate",
        deploymentId: "dep_123",
        clientToken: "client_token_123",
      },
    })

    expect(result).toEqual({ ok: true, status: "active" })
    expect(fetchCalls[0]?.init?.headers).toMatchObject({
      Authorization: "Bearer client_token_123",
      "Content-Type": "application/json",
    })
    expect(JSON.parse(String(fetchCalls[0]?.init?.body))).toEqual({
      deploymentId: "dep_123",
      workosUserId: "user_workos_123",
    })
  })

  it("returns revoked responses from Cloud", async () => {
    const fetch = async () =>
      Response.json({ ok: false, status: "revoked", reason: "no_membership" }, { status: 403 })

    await expect(
      revalidateCloudAdminAuthAccess({
        workosUserId: "user_workos_123",
        fetch: fetch as typeof globalThis.fetch,
        config: {
          revalidateUrl: "https://api.voyant.travel/cloud/v1/admin-auth/revalidate",
          deploymentId: "dep_123",
          clientToken: "client_token_123",
        },
      }),
    ).resolves.toEqual({
      ok: false,
      status: "revoked",
      reason: "no_membership",
    })
  })

  it("surfaces refreshed scopes when Cloud includes them", async () => {
    const fetch = async () =>
      Response.json({ ok: true, status: "active", scopes: ["bookings:read"] })

    await expect(
      revalidateCloudAdminAuthAccess({
        workosUserId: "user_workos_123",
        fetch: fetch as typeof globalThis.fetch,
        config: {
          revalidateUrl: "https://api.voyant.travel/cloud/v1/admin-auth/revalidate",
          deploymentId: "dep_123",
          clientToken: "client_token_123",
        },
      }),
    ).resolves.toEqual({ ok: true, status: "active", scopes: ["bookings:read"] })
  })

  it("omits scopes when Cloud doesn't send them (older platform)", async () => {
    const fetch = async () => Response.json({ ok: true, status: "active" })

    const result = await revalidateCloudAdminAuthAccess({
      workosUserId: "user_workos_123",
      fetch: fetch as typeof globalThis.fetch,
      config: {
        revalidateUrl: "https://api.voyant.travel/cloud/v1/admin-auth/revalidate",
        deploymentId: "dep_123",
        clientToken: "client_token_123",
      },
    })

    expect("scopes" in result).toBe(false)
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

describe("exchangeCloudAdminAuthCode", () => {
  it("exchanges a grant and verifies the signed Cloud assertion", async () => {
    const { assertion, publicJwk } = await signTestAssertion({
      aud: "dep_123",
      deploymentId: "dep_123",
      nonce: "nonce_123",
    })
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = []
    const fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const href = url.toString()
      fetchCalls.push({ url: href, init })
      if (href === "https://api.voyant.travel/dashboard/v1/admin-auth/exchange") {
        return Response.json({ assertion })
      }
      if (href === "https://api.voyant.travel/.well-known/admin-auth/jwks.json") {
        return Response.json({ keys: [publicJwk] })
      }
      return Response.json({ error: "not found" }, { status: 404 })
    }

    const result = await exchangeCloudAdminAuthCode({
      code: "code_123",
      state: {
        state: "state_123",
        nonce: "nonce_123",
        deploymentId: "dep_123",
        redirectUri: "https://admin.example.com/api/auth/admin/cloud/callback",
        next: "/",
        expiresAt: Date.now() + 60_000,
      },
      now: new Date("2026-05-16T00:00:10.000Z"),
      fetch: fetch as typeof globalThis.fetch,
      config: {
        exchangeUrl: "https://api.voyant.travel/dashboard/v1/admin-auth/exchange",
        deploymentId: "dep_123",
        clientToken: "client_token_123",
        assertionJwksUrl: "https://api.voyant.travel/.well-known/admin-auth/jwks.json",
        assertionAudience: "dep_123",
      },
    })

    expect(result.email).toBe("admin@example.com")
    expect(result.workosUserId).toBe("user_workos_123")
    expect(fetchCalls[0]?.init?.headers).toMatchObject({
      Authorization: "Bearer client_token_123",
      "Content-Type": "application/json",
    })
    expect(JSON.parse(String(fetchCalls[0]?.init?.body))).toMatchObject({
      code: "code_123",
      deploymentId: "dep_123",
      nonce: "nonce_123",
      redirectUri: "https://admin.example.com/api/auth/admin/cloud/callback",
    })
  })

  it("rejects assertions with the wrong nonce", async () => {
    const { assertion, publicJwk } = await signTestAssertion({
      aud: "dep_123",
      deploymentId: "dep_123",
      nonce: "other_nonce",
    })
    const fetch = async (url: string | URL | Request) => {
      if (url.toString().endsWith("/exchange")) return Response.json({ assertion })
      return Response.json({ keys: [publicJwk] })
    }

    await expect(
      exchangeCloudAdminAuthCode({
        code: "code_123",
        state: {
          state: "state_123",
          nonce: "nonce_123",
          deploymentId: "dep_123",
          redirectUri: "https://admin.example.com/api/auth/admin/cloud/callback",
          next: "/",
          expiresAt: Date.now() + 60_000,
        },
        now: new Date("2026-05-16T00:00:10.000Z"),
        fetch: fetch as typeof globalThis.fetch,
        config: {
          exchangeUrl: "https://api.voyant.travel/dashboard/v1/admin-auth/exchange",
          deploymentId: "dep_123",
          clientToken: "client_token_123",
          assertionJwksUrl: "https://api.voyant.travel/.well-known/admin-auth/jwks.json",
          assertionAudience: "dep_123",
        },
      }),
    ).rejects.toThrow("nonce mismatch")
  })
})

async function signTestAssertion(input: { aud: string; deploymentId: string; nonce: string }) {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey)
  publicJwk.kid = "test-key"
  publicJwk.alg = "RS256"
  publicJwk.use = "sig"

  const header = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ alg: "RS256", kid: "test-key", typ: "JWT" })),
  )
  const payload = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        iss: VOYANT_CLOUD_ADMIN_ASSERTION_ISSUER,
        aud: input.aud,
        sub: "user_workos_123",
        email: "admin@example.com",
        emailVerified: true,
        name: "Admin Example",
        workosUserId: "user_workos_123",
        workosOrganizationId: "org_workos_123",
        platformOrganizationId: "org_platform_123",
        platformOrganizationSlug: "example",
        deploymentId: input.deploymentId,
        membershipId: "membership_123",
        roleSlug: "owner",
        roleName: "Owner",
        surfaces: ["admin"],
        nonce: input.nonce,
        iat: Math.floor(new Date("2026-05-16T00:00:00.000Z").getTime() / 1000),
        exp: Math.floor(new Date("2026-05-16T00:05:00.000Z").getTime() / 1000),
      }),
    ),
  )
  const signingInput = `${header}.${payload}`
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    keyPair.privateKey,
    new TextEncoder().encode(signingInput),
  )

  return {
    assertion: `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`,
    publicJwk,
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

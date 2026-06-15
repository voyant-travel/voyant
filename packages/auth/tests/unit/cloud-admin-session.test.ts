import { describe, expect, it } from "vitest"

import { createVoyantCloudAdminAuthPlugin } from "../../src/cloud-admin-session.js"

describe("createVoyantCloudAdminAuthPlugin", () => {
  it("mounts the Better Auth cloud callback endpoint", () => {
    const plugin = createVoyantCloudAdminAuthPlugin({
      db: {} as never,
      cookieSecret: "test-cloud-auth-cookie-secret-with-more-than-32-chars",
      exchange: {
        exchangeUrl: "https://api.voyant.travel/dashboard/v1/admin-auth/exchange",
        deploymentId: "dep_123",
        clientToken: "client_token_123",
        assertionJwksUrl: "https://api.voyant.travel/.well-known/admin-auth/jwks.json",
        assertionAudience: "dep_123",
      },
      onUserProvisioning: ({ isNewUser, provider }) => {
        expect(isNewUser).toEqual(expect.any(Boolean))
        expect(provider.providerId).toBe("voyant-cloud")
      },
    })

    expect(plugin.id).toBe("voyant-cloud-admin-auth")
    expect(plugin.endpoints?.voyantCloudAdminAuthCallback.path).toBe("/cloud/callback")
  })
})

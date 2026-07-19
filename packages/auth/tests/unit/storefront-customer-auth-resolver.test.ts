import { describe, expect, it } from "vitest"

import {
  createLocalStorefrontCustomerAuthResolver,
  STOREFRONT_KEY_HEADER,
  STOREFRONT_ORIGIN_HEADER,
  StorefrontCustomerAuthResolutionError,
} from "../../src/storefront-customer-auth-resolver.js"
import type {
  ResolvedStorefrontApiKey,
  ResolvedStorefrontProviderCredentials,
  StorefrontDto,
  StorefrontRuntimeProvider,
} from "../../src/storefront-runtime-port.js"

const STOREFRONT: StorefrontDto = {
  id: "sf_1",
  organizationId: "org_1",
  name: "Shop",
  slug: "shop",
  hostingKind: "external",
  siteId: null,
  allowedOrigins: ["https://shop.example.com", "https://*.example.com"],
  methods: { emailCode: true, emailPassword: false, google: true, facebook: false, apple: false },
  accountPolicy: {
    allowedKinds: ["personal"],
    personalSignup: "open",
    businessOnboarding: "disabled",
  },
  hostOnlyCookies: true,
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z",
}

function fakeProvider(overrides?: {
  resolveStorefrontByApiKey?: () => Promise<ResolvedStorefrontApiKey | null>
  resolveProviderCredentials?: () => Promise<ResolvedStorefrontProviderCredentials>
}): StorefrontRuntimeProvider {
  return {
    async resolveStorefrontByApiKey() {
      return (
        overrides?.resolveStorefrontByApiKey?.() ??
        Promise.resolve({
          storefront: STOREFRONT,
          key: {
            id: "sfk_1",
            storefrontId: "sf_1",
            kind: "publishable",
            tokenPreview: "vpk_ab12cd",
            name: null,
            lastUsedAt: null,
            revokedAt: null,
            createdAt: "2026-07-19T00:00:00.000Z",
          },
        })
      )
    },
    async resolveProviderCredentials() {
      return (
        overrides?.resolveProviderCredentials?.() ??
        Promise.resolve({ google: { clientId: "g-id", clientSecret: "g-secret" } })
      )
    },
    // Unused by the resolver; present to satisfy the provider contract.
  } as unknown as StorefrontRuntimeProvider
}

function makeResolver(provider: StorefrontRuntimeProvider) {
  let disposed = 0
  const resolver = createLocalStorefrontCustomerAuthResolver<{ KMS_PROVIDER?: string }>({
    provider,
    async openResolveContext() {
      return {
        context: { bindings: {}, db: {} as never },
        dispose: async () => {
          disposed += 1
        },
      }
    },
  })
  return { resolver, disposed: () => disposed }
}

function request(headers: Record<string, string>): Request {
  return new Request("https://api.example.com/api/v1/public", { headers })
}

describe("createLocalStorefrontCustomerAuthResolver", () => {
  it("resolves methods, trusted origins, policy, and decrypted social secrets", async () => {
    const { resolver, disposed } = makeResolver(fakeProvider())
    const context = await resolver(
      {},
      request({
        [STOREFRONT_ORIGIN_HEADER]: "https://shop.example.com",
        [STOREFRONT_KEY_HEADER]: "vpk_token",
      }),
    )
    expect(context).toEqual({
      baseURL: "https://shop.example.com",
      publicApiBaseURL: "https://shop.example.com/api",
      invitationAcceptBaseURL: "https://shop.example.com",
      trustedOrigins: ["https://shop.example.com"],
      methods: {
        emailCode: true,
        emailPassword: false,
        socialProviders: { google: { clientId: "g-id", clientSecret: "g-secret" } },
      },
      accountPolicy: STOREFRONT.accountPolicy,
    })
    expect(disposed()).toBe(1)
  })

  it("accepts a wildcard-matched origin", async () => {
    const { resolver } = makeResolver(fakeProvider())
    const context = await resolver(
      {},
      request({
        [STOREFRONT_ORIGIN_HEADER]: "https://preview.example.com",
        [STOREFRONT_KEY_HEADER]: "vpk_token",
      }),
    )
    expect(context.baseURL).toBe("https://preview.example.com")
  })

  async function rejection(
    promise: Promise<unknown>,
  ): Promise<StorefrontCustomerAuthResolutionError> {
    try {
      await promise
    } catch (error) {
      return error as StorefrontCustomerAuthResolutionError
    }
    throw new Error("expected the resolver to reject")
  }

  it("requires the origin header", async () => {
    const { resolver } = makeResolver(fakeProvider())
    const error = await rejection(resolver({}, request({ [STOREFRONT_KEY_HEADER]: "vpk_token" })))
    expect(error).toBeInstanceOf(StorefrontCustomerAuthResolutionError)
    expect(error.message).toMatch(/origin/i)
    expect(error.reason).toBe("missing_origin")
    expect(error.status).toBe(401)
    expect(error.code).toBe("unauthorized")
  })

  it("requires the key header", async () => {
    const { resolver } = makeResolver(fakeProvider())
    const error = await rejection(
      resolver({}, request({ [STOREFRONT_ORIGIN_HEADER]: "https://shop.example.com" })),
    )
    expect(error.message).toMatch(/key/i)
    expect(error.reason).toBe("missing_key")
    expect(error.status).toBe(401)
    // The message must not echo any presented key.
    expect(error.message).not.toMatch(/vpk_/)
  })

  it("rejects an unknown or revoked key", async () => {
    const { resolver, disposed } = makeResolver(
      fakeProvider({ resolveStorefrontByApiKey: async () => null }),
    )
    const error = await rejection(
      resolver(
        {},
        request({
          [STOREFRONT_ORIGIN_HEADER]: "https://shop.example.com",
          [STOREFRONT_KEY_HEADER]: "vpk_bad",
        }),
      ),
    )
    expect(error.message).toMatch(/unknown or revoked/i)
    expect(error.reason).toBe("unknown_key")
    expect(error.status).toBe(401)
    expect(error.message).not.toMatch(/vpk_bad/)
    expect(disposed()).toBe(1)
  })

  it("rejects an origin outside the declared allowlist as forbidden", async () => {
    const { resolver } = makeResolver(fakeProvider())
    const error = await rejection(
      resolver(
        {},
        request({
          [STOREFRONT_ORIGIN_HEADER]: "https://evil.com",
          [STOREFRONT_KEY_HEADER]: "vpk_token",
        }),
      ),
    )
    expect(error.message).toMatch(/declared allowed origin/i)
    expect(error.reason).toBe("origin_not_allowed")
    // A known key from a disallowed origin is a 403 (forbidden), not a 401.
    expect(error.status).toBe(403)
    expect(error.code).toBe("forbidden")
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { CreateBetterAuthOptions } from "../../src/server.js"

type BetterAuthConfig = {
  advanced: {
    crossSubDomainCookies?: {
      enabled: boolean
      domain?: string
    }
    defaultCookieAttributes?: {
      domain?: string
      sameSite?: string
    }
    useSecureCookies: boolean
  }
  databaseHooks: {
    user: {
      create: {
        before: (
          user?: Record<string, unknown>,
          context?: { path?: string } | null,
        ) => Promise<undefined | { data: Record<string, unknown> }>
        after: (user: Record<string, unknown>, context?: { path?: string } | null) => Promise<void>
      }
    }
  }
}

const { betterAuthMock, drizzleAdapterMock, isFirstAuthUserMock, provisionCurrentUserProfileMock } =
  vi.hoisted(() => ({
    betterAuthMock: vi.fn((config: Record<string, unknown>) => ({ config })),
    drizzleAdapterMock: vi.fn(() => ({ adapter: "drizzle" })),
    isFirstAuthUserMock: vi.fn(async () => false),
    provisionCurrentUserProfileMock: vi.fn(async () => undefined),
  }))

vi.mock("@better-auth/api-key", () => ({
  apiKey: vi.fn((options: Record<string, unknown>) => ({ id: "apiKey", options })),
}))

vi.mock("@voyant-travel/db", () => ({
  getDb: vi.fn(() => ({ id: "default-db" })),
}))

vi.mock("@voyant-travel/db/schema/iam", () => ({
  apikeyTable: { name: "apikey" },
  authAccount: { name: "account" },
  authSession: { name: "session" },
  authUser: { name: "user" },
  authVerification: { name: "verification" },
  userProfilesTable: { name: "userProfiles" },
}))

vi.mock("better-auth", () => ({
  betterAuth: betterAuthMock,
}))

vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: drizzleAdapterMock,
}))

vi.mock("better-auth/plugins", () => ({
  emailOTP: vi.fn((options: Record<string, unknown>) => ({ id: "emailOTP", options })),
}))

vi.mock("../../src/workspace.js", () => ({
  isFirstAuthUser: isFirstAuthUserMock,
  provisionCurrentUserProfile: provisionCurrentUserProfileMock,
}))

describe("createBetterAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  function latestBetterAuthConfig(): BetterAuthConfig {
    return betterAuthMock.mock.calls.at(-1)?.[0] as BetterAuthConfig
  }

  function createDbWithUserCount(count: number) {
    const from = vi.fn(async () => [{ count }])
    const select = vi.fn(() => ({ from }))
    return {
      db: { select },
      from,
      select,
    }
  }

  it("defaults secure cookies on outside explicit local development", async () => {
    const { createBetterAuth } = await import("../../src/server.js")

    createBetterAuth({
      db: { id: "db" } as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
    })

    expect(latestBetterAuthConfig().advanced.useSecureCookies).toBe(true)
  })

  it("defaults secure cookies off in explicit local development", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const { createBetterAuth } = await import("../../src/server.js")

    createBetterAuth({
      db: { id: "db" } as never,
      secret: "x".repeat(32),
      baseURL: "http://localhost:3000",
    })

    expect(latestBetterAuthConfig().advanced.useSecureCookies).toBe(false)
  })

  it("lets consumers override secure cookie handling for local HTTP", async () => {
    const { createBetterAuth } = await import("../../src/server.js")

    createBetterAuth({
      db: { id: "db" } as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
      advanced: {
        useSecureCookies: false,
      },
    })

    expect(latestBetterAuthConfig().advanced.useSecureCookies).toBe(false)
  })

  it("forwards Better Auth advanced cookie options", async () => {
    const { createBetterAuth } = await import("../../src/server.js")

    createBetterAuth({
      db: { id: "db" } as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
      advanced: {
        crossSubDomainCookies: {
          enabled: true,
          domain: ".example.com",
        },
        defaultCookieAttributes: {
          domain: ".example.com",
          sameSite: "lax",
        },
      },
    })

    expect(latestBetterAuthConfig().advanced).toMatchObject({
      crossSubDomainCookies: {
        enabled: true,
        domain: ".example.com",
      },
      defaultCookieAttributes: {
        domain: ".example.com",
        sameSite: "lax",
      },
      useSecureCookies: true,
    })
  })

  it("forwards Better Auth user options and keeps Voyant's default change-email setting", async () => {
    const { createBetterAuth } = await import("../../src/server.js")
    const user = {
      additionalFields: {
        surfaces: {
          type: "string",
          required: false,
          input: true,
        },
      },
      deleteUser: {
        enabled: true,
      },
    } satisfies NonNullable<CreateBetterAuthOptions["user"]>

    createBetterAuth({
      db: { id: "db" } as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
      user,
    })

    expect(betterAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user: {
          ...user,
          changeEmail: {
            enabled: true,
          },
        },
      }),
    )
  })

  it("lets consumers override the default change-email setting", async () => {
    const { createBetterAuth } = await import("../../src/server.js")

    createBetterAuth({
      db: { id: "db" } as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
      user: {
        changeEmail: {
          enabled: false,
        },
      },
    })

    expect(betterAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user: {
          changeEmail: {
            enabled: false,
          },
        },
      }),
    )
  })

  it("merges extra Better Auth plugin tables into the Drizzle adapter schema", async () => {
    const { createBetterAuth } = await import("../../src/server.js")
    const jwksTable = { name: "jwks" }

    createBetterAuth({
      db: { id: "db" } as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
      extraSchema: {
        jwks: jwksTable,
      } as never,
    })

    const [, adapterConfig] = drizzleAdapterMock.mock.calls[0] as [
      unknown,
      { schema: Record<string, unknown> },
    ]

    expect(adapterConfig.schema).toMatchObject({
      user: { name: "user" },
      session: { name: "session" },
      account: { name: "account" },
      verification: { name: "verification" },
      apikey: { name: "apikey" },
      jwks: jwksTable,
    })
  })

  it("uses secondary storage for Better Auth rate limits when provided", async () => {
    const { createBetterAuth } = await import("../../src/server.js")
    const secondaryStorage = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    }

    createBetterAuth({
      db: { id: "db" } as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
      secondaryStorage,
    })

    expect(betterAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        secondaryStorage,
        rateLimit: expect.objectContaining({
          enabled: true,
          storage: "secondary-storage",
        }),
      }),
    )
  })

  it("does not fall back to SESSION_CLAIMS_SECRET for Better Auth", async () => {
    const { getAuthSecret } = await import("../../src/server.js")
    const originalBetterAuthSecret = process.env.BETTER_AUTH_SECRET
    const originalSessionClaimsSecret = process.env.SESSION_CLAIMS_SECRET
    try {
      delete process.env.BETTER_AUTH_SECRET
      process.env.SESSION_CLAIMS_SECRET = "s".repeat(40)
      expect(() => getAuthSecret()).toThrow(/BETTER_AUTH_SECRET/)
    } finally {
      process.env.BETTER_AUTH_SECRET = originalBetterAuthSecret
      process.env.SESSION_CLAIMS_SECRET = originalSessionClaimsSecret
    }
  })

  it("preserves consumer plugins alongside Voyant's required auth plugins", async () => {
    const { createBetterAuth } = await import("../../src/server.js")
    const jwtPlugin = { id: "jwt" }
    const customPlugin = { id: "custom", schema: { customTable: { name: "customTable" } } }

    createBetterAuth({
      db: { id: "db" } as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
      plugins: [jwtPlugin, customPlugin] as never,
      extraSchema: {
        jwks: { name: "jwks" },
        customTable: { name: "customTable" },
      } as never,
    })

    expect(betterAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: [
          expect.objectContaining({ id: "apiKey" }),
          expect.objectContaining({ id: "emailOTP" }),
          jwtPlugin,
          customPlugin,
        ],
      }),
    )
  })

  it("keeps the default signup block for admin users once any user exists", async () => {
    const { createBetterAuth } = await import("../../src/server.js")
    const { db } = createDbWithUserCount(1)

    createBetterAuth({
      db: db as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
    })

    await expect(latestBetterAuthConfig().databaseHooks.user.create.before()).rejects.toThrow(
      "Sign-up is disabled. Ask an admin to invite you.",
    )
  })

  it("does not apply the default signup block to explicit non-admin surfaces", async () => {
    const { createBetterAuth } = await import("../../src/server.js")
    const { db, select } = createDbWithUserCount(1)

    createBetterAuth({
      db: db as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
    })

    await expect(
      latestBetterAuthConfig().databaseHooks.user.create.before({
        surfaces: ["storefront"],
      }),
    ).resolves.toBeUndefined()
    expect(select).not.toHaveBeenCalled()
  })

  it("stamps configured customer surfaces on phone OTP self-signups before the signup block", async () => {
    const { createBetterAuth } = await import("../../src/server.js")
    const { db, select } = createDbWithUserCount(1)

    createBetterAuth({
      db: db as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
      customerSignupSurfaces: ["storefront"],
    })

    await expect(
      latestBetterAuthConfig().databaseHooks.user.create.before(
        {
          phoneNumber: "+40700000001",
          surfaces: ["admin"],
        },
        { path: "/auth/phone-number/verify" },
      ),
    ).resolves.toEqual({
      data: {
        phoneNumber: "+40700000001",
        surfaces: ["storefront"],
      },
    })
    expect(select).not.toHaveBeenCalled()
  })

  it("stamps configured customer surfaces on email OTP self-signups before the signup block", async () => {
    const { createBetterAuth } = await import("../../src/server.js")
    const { db, select } = createDbWithUserCount(1)

    createBetterAuth({
      db: db as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
      customerSignupSurfaces: ["storefront", "storefront", " "],
    })

    await expect(
      latestBetterAuthConfig().databaseHooks.user.create.before(
        {
          email: "ana@example.com",
          surfaces: ["admin"],
        },
        { path: "/sign-in/email-otp" },
      ),
    ).resolves.toEqual({
      data: {
        email: "ana@example.com",
        surfaces: ["storefront"],
      },
    })
    expect(select).not.toHaveBeenCalled()
  })

  it("stamps configured customer surfaces on email/password self-signups before the signup block", async () => {
    const { createBetterAuth } = await import("../../src/server.js")
    const { db, select } = createDbWithUserCount(1)

    createBetterAuth({
      db: db as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
      customerSignupSurfaces: ["customer"],
    })

    await expect(
      latestBetterAuthConfig().databaseHooks.user.create.before(
        {
          email: "ana@example.com",
          surfaces: ["admin"],
        },
        { path: "/auth/sign-up/email" },
      ),
    ).resolves.toEqual({
      data: {
        email: "ana@example.com",
        surfaces: ["customer"],
      },
    })
    expect(select).not.toHaveBeenCalled()
  })

  it("does not stamp customer surfaces on non-customer signup endpoints", async () => {
    const { createBetterAuth } = await import("../../src/server.js")
    const { db } = createDbWithUserCount(1)

    createBetterAuth({
      db: db as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
      customerSignupSurfaces: ["storefront"],
    })

    await expect(
      latestBetterAuthConfig().databaseHooks.user.create.before(
        {
          surfaces: ["admin"],
        },
        { path: "/auth/sign-in/email" },
      ),
    ).rejects.toThrow("Sign-up is disabled. Ask an admin to invite you.")
  })

  it("does not provision workspace profiles for customer self-signups", async () => {
    const { createBetterAuth } = await import("../../src/server.js")

    createBetterAuth({
      db: { id: "db" } as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
      customerSignupSurfaces: ["customer"],
    })

    await latestBetterAuthConfig().databaseHooks.user.create.after(
      { id: "user_1", name: "Ana Customer", image: null },
      { path: "/auth/sign-up/email" },
    )

    expect(isFirstAuthUserMock).not.toHaveBeenCalled()
    expect(provisionCurrentUserProfileMock).not.toHaveBeenCalled()
  })

  it("still provisions workspace profiles for admin signups", async () => {
    const { createBetterAuth } = await import("../../src/server.js")

    createBetterAuth({
      db: { id: "db" } as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
    })

    await latestBetterAuthConfig().databaseHooks.user.create.after(
      { id: "user_1", name: "Ana Admin", image: null },
      { path: "/auth/sign-up/email" },
    )

    expect(isFirstAuthUserMock).toHaveBeenCalled()
    expect(provisionCurrentUserProfileMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "user_1",
        name: "Ana Admin",
      }),
    )
  })

  it("treats blank surface array entries as missing surfaces for the signup block", async () => {
    const { createBetterAuth } = await import("../../src/server.js")
    const { db } = createDbWithUserCount(1)

    createBetterAuth({
      db: db as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
    })

    await expect(
      latestBetterAuthConfig().databaseHooks.user.create.before({
        surfaces: ["", "  "],
      }),
    ).rejects.toThrow("Sign-up is disabled. Ask an admin to invite you.")
  })

  it("lets consumers customize the surfaces guarded by the signup block", async () => {
    const { createBetterAuth } = await import("../../src/server.js")
    const { db, select } = createDbWithUserCount(1)

    createBetterAuth({
      db: db as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
      disableSignupWhenUsersExist: {
        surfaces: ["staff"],
      },
    })

    await expect(
      latestBetterAuthConfig().databaseHooks.user.create.before({
        surfaces: ["admin"],
      }),
    ).resolves.toBeUndefined()
    expect(select).not.toHaveBeenCalled()

    await expect(
      latestBetterAuthConfig().databaseHooks.user.create.before({
        surfaces: ["staff"],
      }),
    ).rejects.toThrow("Sign-up is disabled. Ask an admin to invite you.")
  })

  it("lets consumers disable the bundled signup block", async () => {
    const { createBetterAuth } = await import("../../src/server.js")
    const { db, select } = createDbWithUserCount(1)

    createBetterAuth({
      db: db as never,
      secret: "x".repeat(32),
      baseURL: "https://auth.example.com",
      disableSignupWhenUsersExist: {
        enabled: false,
      },
    })

    await expect(
      latestBetterAuthConfig().databaseHooks.user.create.before(),
    ).resolves.toBeUndefined()
    expect(select).not.toHaveBeenCalled()
  })
})

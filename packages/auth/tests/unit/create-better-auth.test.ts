import { beforeEach, describe, expect, it, vi } from "vitest"

import type { CreateBetterAuthOptions } from "../../src/server.js"

const { betterAuthMock, drizzleAdapterMock } = vi.hoisted(() => ({
  betterAuthMock: vi.fn((config: Record<string, unknown>) => ({ config })),
  drizzleAdapterMock: vi.fn(() => ({ adapter: "drizzle" })),
}))

vi.mock("@better-auth/api-key", () => ({
  apiKey: vi.fn((options: Record<string, unknown>) => ({ id: "apiKey", options })),
}))

vi.mock("@voyantjs/db", () => ({
  getDb: vi.fn(() => ({ id: "default-db" })),
}))

vi.mock("@voyantjs/db/schema/iam", () => ({
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

describe("createBetterAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})

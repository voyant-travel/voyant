import { describe, expect, it, vi } from "vitest"

import {
  buildBetterAuthCookieAdvancedOptions,
  createOperatorAuthNodeRuntime,
} from "../../src/node-runtime.js"

describe("buildBetterAuthCookieAdvancedOptions", () => {
  it("leaves Better Auth cookie defaults untouched when the domain is unset", () => {
    expect(buildBetterAuthCookieAdvancedOptions({})).toBeUndefined()
    expect(buildBetterAuthCookieAdvancedOptions({ AUTH_COOKIE_DOMAIN: "   " })).toBeUndefined()
  })

  it("enables cross-subdomain cookies for the configured domain", () => {
    expect(buildBetterAuthCookieAdvancedOptions({ AUTH_COOKIE_DOMAIN: " .example.com " })).toEqual({
      crossSubDomainCookies: {
        enabled: true,
        domain: ".example.com",
      },
      defaultCookieAttributes: {
        domain: ".example.com",
      },
    })
  })
})

describe("createOperatorAuthNodeRuntime", () => {
  it("exposes only the canonical admin cloud start route", async () => {
    const openDatabase = vi.fn(() => {
      throw new Error("cloud start route must not open the database")
    })
    const runtime = createOperatorAuthNodeRuntime({
      accessCatalog: { resources: [], presets: [] },
      appName: "auth-test",
      authMode: "voyant-cloud",
      reporter: { captureException: vi.fn() },
      openDatabase,
    })
    const env = {
      DATABASE_URL: "postgres://unused",
      SESSION_CLAIMS_ADMIN_SECRET: "admin-session-claims-secret-with-32-characters",
    }

    const canonical = await runtime.handler.fetch(
      new Request("https://admin.example.com/auth/admin/cloud/start"),
      env,
      { waitUntil: vi.fn() } as never,
    )
    const legacy = await runtime.handler.fetch(
      new Request("https://admin.example.com/auth/cloud/start"),
      env,
      { waitUntil: vi.fn() } as never,
    )

    expect(canonical.status).toBe(501)
    expect(legacy.status).toBe(404)
    expect(openDatabase).not.toHaveBeenCalled()
  })

  it("rejects existing customer sessions when the customer realm is disabled", async () => {
    const openDatabase = vi.fn(() => {
      throw new Error("the disabled customer realm must not open the database")
    })
    const runtime = createOperatorAuthNodeRuntime({
      accessCatalog: { resources: [], presets: [] },
      appName: "auth-test",
      authMode: "local",
      reporter: { captureException: vi.fn() },
      openDatabase,
    })

    await expect(
      runtime.resolveAuthRequest(
        new Request("https://store.example.com/v1/public/customer/profile", {
          headers: { cookie: "voyant-customer.session_token=existing-session" },
        }),
        {
          DATABASE_URL: "postgres://unused",
          SESSION_CLAIMS_ADMIN_SECRET: "admin-session-claims-secret",
          VOYANT_CUSTOMER_AUTH_MODE: "disabled",
        },
      ),
    ).resolves.toBeNull()
    expect(openDatabase).not.toHaveBeenCalled()
  })

  it("classifies the exact public root as customer auth and rejects it before DB when disabled", async () => {
    const openDatabase = vi.fn(() => {
      throw new Error("the disabled customer realm must not open the database")
    })
    const runtime = createOperatorAuthNodeRuntime({
      accessCatalog: { resources: [], presets: [] },
      appName: "auth-test",
      authMode: "local",
      reporter: { captureException: vi.fn() },
      openDatabase,
    })

    await expect(
      runtime.resolveAuthRequest(new Request("https://store.example.com/v1/public"), {
        DATABASE_URL: "postgres://unused",
        SESSION_CLAIMS_ADMIN_SECRET: "admin-session-claims-secret",
        VOYANT_CUSTOMER_AUTH_MODE: "disabled",
      }),
    ).resolves.toBeNull()
    expect(openDatabase).not.toHaveBeenCalled()
  })

  it("reports disabled customer status without opening the database", async () => {
    const openDatabase = vi.fn(() => {
      throw new Error("disabled customer status must not open the database")
    })
    const runtime = createOperatorAuthNodeRuntime({
      accessCatalog: { resources: [], presets: [] },
      appName: "auth-test",
      authMode: "local",
      reporter: { captureException: vi.fn() },
      openDatabase,
    })

    const response = await runtime.handler.fetch(
      new Request("https://store.example.com/auth/customer/status"),
      {
        DATABASE_URL: "postgres://unused",
        SESSION_CLAIMS_ADMIN_SECRET: "admin-session-claims-secret",
        VOYANT_CUSTOMER_AUTH_MODE: "disabled",
      },
      { waitUntil: vi.fn() } as never,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ authenticated: false, disabled: true })
    expect(openDatabase).not.toHaveBeenCalled()
  })

  it("fails closed for paths that only contain a public-surface substring", async () => {
    const openDatabase = vi.fn(() => {
      throw new Error("ambiguous paths must not open the database")
    })
    const runtime = createOperatorAuthNodeRuntime({
      accessCatalog: { resources: [], presets: [] },
      appName: "auth-test",
      authMode: "local",
      reporter: { captureException: vi.fn() },
      openDatabase,
    })

    await expect(
      runtime.resolveAuthRequest(new Request("https://admin.example.com/not-v1/public/profile"), {
        DATABASE_URL: "postgres://unused",
        SESSION_CLAIMS_ADMIN_SECRET: "admin-session-claims-secret",
      }),
    ).resolves.toBeNull()
    expect(openDatabase).not.toHaveBeenCalled()
  })

  it("does not accept the legacy Better Auth secret for admin sessions", async () => {
    const dispose = vi.fn(async () => {})
    const runtime = createOperatorAuthNodeRuntime({
      accessCatalog: { resources: [], presets: [] },
      appName: "auth-test",
      authMode: "local",
      reporter: { captureException: vi.fn() },
      openDatabase: () => ({ db: {} as never, dispose }),
    })
    const legacyEnv = {
      DATABASE_URL: "postgres://unused",
      SESSION_CLAIMS_ADMIN_SECRET: "admin-session-claims-secret",
      BETTER_AUTH_SECRET: "legacy-admin-secret",
    }

    await expect(
      runtime.resolveAuthRequest(
        new Request("https://admin.example.com/v1/admin/profile"),
        legacyEnv,
      ),
    ).rejects.toThrow("Admin auth requires BETTER_AUTH_ADMIN_SECRET")
    expect(dispose).toHaveBeenCalledOnce()
  })

  it("requires a customer secret instead of deriving one from the admin realm", async () => {
    const dispose = vi.fn(async () => {})
    const runtime = createOperatorAuthNodeRuntime({
      accessCatalog: { resources: [], presets: [] },
      appName: "auth-test",
      authMode: "local",
      reporter: { captureException: vi.fn() },
      openDatabase: () => ({ db: {} as never, dispose }),
    })

    await expect(
      runtime.resolveAuthRequest(new Request("https://store.example.com/v1/public/profile"), {
        DATABASE_URL: "postgres://unused",
        SESSION_CLAIMS_ADMIN_SECRET: "admin-session-claims-secret",
        BETTER_AUTH_ADMIN_SECRET: "admin-secret",
      }),
    ).rejects.toThrow("Customer auth requires BETTER_AUTH_CUSTOMER_SECRET")
    expect(dispose).toHaveBeenCalledOnce()
  })
})

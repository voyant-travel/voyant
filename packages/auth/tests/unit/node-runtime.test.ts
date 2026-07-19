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
  it("surfaces active managed modules in bootstrap status", async () => {
    const openDatabase = vi.fn(() => {
      throw new Error("managed bootstrap status must not open the database")
    })
    const runtime = createOperatorAuthNodeRuntime({
      accessCatalog: { resources: [], presets: [] },
      activeModules: ["catalog", "storefront"],
      appName: "auth-test",
      authMode: "voyant-cloud",
      reporter: { captureException: vi.fn() },
      openDatabase,
    })

    const response = await runtime.handler.fetch(
      new Request("https://admin.example.com/auth/bootstrap-status"),
      {
        DATABASE_URL: "postgres://unused",
        SESSION_CLAIMS_ADMIN_SECRET: "admin-session-claims-secret",
      },
      { waitUntil: vi.fn() } as never,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      hasUsers: true,
      authMode: "voyant-cloud",
      modules: ["catalog", "storefront"],
    })
    expect(openDatabase).not.toHaveBeenCalled()
  })

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

  it("awaits managed customer auth context for the public configuration", async () => {
    const resolveCustomerAuthContext = vi.fn(async () => {
      await Promise.resolve()
      return {
        baseURL: "https://shop.example.com",
        publicApiBaseURL: "https://shop.example.com/api",
        trustedOrigins: ["https://shop.example.com"],
        methods: {
          emailCode: true,
          emailPassword: false,
          socialProviders: {
            google: { clientId: "google-id", clientSecret: "google-secret" },
          },
        },
      }
    })
    const runtime = createOperatorAuthNodeRuntime({
      accessCatalog: { resources: [], presets: [] },
      appName: "auth-test",
      authMode: "voyant-cloud",
      reporter: { captureException: vi.fn() },
      resolveCustomerAuthContext,
    })

    const response = await runtime.handler.fetch(
      new Request("https://runtime.internal/auth/customer/config"),
      {
        DATABASE_URL: "postgres://unused",
        SESSION_CLAIMS_ADMIN_SECRET: "admin-session-claims-secret",
      },
      { waitUntil: vi.fn() } as never,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      accountPolicy: {
        allowedKinds: ["personal"],
        personalSignup: "open",
        businessOnboarding: "disabled",
      },
      methods: {
        emailCode: true,
        emailPassword: false,
        google: true,
        facebook: false,
        apple: false,
      },
    })
    expect(resolveCustomerAuthContext).toHaveBeenCalledOnce()
  })

  it.each([
    {
      label: "non-origin base URL",
      context: {
        baseURL: "https://shop.example.com/tenant",
        publicApiBaseURL: "https://shop.example.com/api",
        trustedOrigins: ["https://shop.example.com"],
      },
    },
    {
      label: "non-API public URL",
      context: {
        baseURL: "https://shop.example.com",
        publicApiBaseURL: "https://evil.example.com/callback",
        trustedOrigins: ["https://shop.example.com"],
      },
    },
    {
      label: "trusted origin with a path",
      context: {
        baseURL: "https://shop.example.com",
        publicApiBaseURL: "https://shop.example.com/api",
        trustedOrigins: ["https://shop.example.com/path"],
      },
    },
  ])("fails closed for a broker context with $label", async ({ context }) => {
    const runtime = createOperatorAuthNodeRuntime({
      accessCatalog: { resources: [], presets: [] },
      appName: "auth-test",
      authMode: "voyant-cloud",
      reporter: { captureException: vi.fn() },
      resolveCustomerAuthContext: async () => ({
        ...context,
        methods: { emailCode: true, emailPassword: true },
      }),
    })

    const response = await runtime.handler.fetch(
      new Request("https://runtime.internal/auth/customer/config"),
      {
        DATABASE_URL: "postgres://unused",
        SESSION_CLAIMS_ADMIN_SECRET: "admin-session-claims-secret",
      },
      { waitUntil: vi.fn() } as never,
    )

    expect(response.status).toBe(500)
  })

  it("awaits managed customer auth context for public API session resolution", async () => {
    const contextError = new Error("customer context broker unavailable")
    const resolveCustomerAuthContext = vi.fn(async () => {
      await Promise.resolve()
      throw contextError
    })
    const dispose = vi.fn(async () => {})
    const runtime = createOperatorAuthNodeRuntime({
      accessCatalog: { resources: [], presets: [] },
      appName: "auth-test",
      authMode: "voyant-cloud",
      reporter: { captureException: vi.fn() },
      openDatabase: () => ({ db: {} as never, dispose }),
      resolveCustomerAuthContext,
    })
    const request = new Request("https://runtime.internal/v1/public/customer/profile")

    await expect(
      runtime.resolveAuthRequest(request, {
        DATABASE_URL: "postgres://unused",
        SESSION_CLAIMS_ADMIN_SECRET: "admin-session-claims-secret",
        BETTER_AUTH_CUSTOMER_SECRET: "customer-secret",
      }),
    ).rejects.toBe(contextError)
    expect(resolveCustomerAuthContext).toHaveBeenCalledWith(expect.anything(), request)
    expect(dispose).toHaveBeenCalledOnce()
  })

  it.each([
    "/auth/customer/status",
    "/auth/customer/sign-in/email",
  ])("awaits managed customer auth context for %s", async (pathname) => {
    const contextError = new Error("customer context broker unavailable")
    const resolveCustomerAuthContext = vi.fn(async () => {
      await Promise.resolve()
      throw contextError
    })
    const dispose = vi.fn(async () => {})
    const runtime = createOperatorAuthNodeRuntime({
      accessCatalog: { resources: [], presets: [] },
      appName: "auth-test",
      authMode: "voyant-cloud",
      reporter: { captureException: vi.fn() },
      openDatabase: () => ({ db: {} as never, dispose }),
      resolveCustomerAuthContext,
    })

    const response = await runtime.handler.fetch(
      new Request(`https://runtime.internal${pathname}`),
      {
        DATABASE_URL: "postgres://unused",
        SESSION_CLAIMS_ADMIN_SECRET: "admin-session-claims-secret",
        BETTER_AUTH_CUSTOMER_SECRET: "customer-secret",
      },
      { waitUntil: vi.fn() } as never,
    )

    expect(response.status).toBe(500)
    expect(resolveCustomerAuthContext).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
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

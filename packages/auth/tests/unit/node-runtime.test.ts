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
          SESSION_CLAIMS_SECRET: "session-claims-secret",
          VOYANT_CUSTOMER_AUTH_MODE: "disabled",
        },
      ),
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
      SESSION_CLAIMS_SECRET: "session-claims-secret",
      BETTER_AUTH_SECRET: "legacy-admin-secret",
    }

    await expect(
      runtime.resolveAuthRequest(
        new Request("https://admin.example.com/v1/private/profile"),
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
        SESSION_CLAIMS_SECRET: "session-claims-secret",
        BETTER_AUTH_ADMIN_SECRET: "admin-secret",
      }),
    ).rejects.toThrow("Customer auth requires BETTER_AUTH_CUSTOMER_SECRET")
    expect(dispose).toHaveBeenCalledOnce()
  })
})

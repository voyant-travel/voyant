import { describe, expect, it } from "vitest"

import { requireVoyantAuthEnv } from "./auth-env.js"

describe("requireVoyantAuthEnv", () => {
  it("rejects auth calls until both secrets are configured", () => {
    expect(() =>
      requireVoyantAuthEnv({
        DATABASE_URL: "postgres://example.test/voyant",
      }),
    ).toThrow("BETTER_AUTH_ADMIN_SECRET and SESSION_CLAIMS_SECRET")
  })

  it("rejects the legacy Better Auth secret", () => {
    const legacyEnv = {
      DATABASE_URL: "postgres://example.test/voyant",
      BETTER_AUTH_SECRET: " better-auth ",
      SESSION_CLAIMS_SECRET: " session-claims ",
    }

    expect(() => requireVoyantAuthEnv(legacyEnv)).toThrow(
      "BETTER_AUTH_ADMIN_SECRET and SESSION_CLAIMS_SECRET",
    )
  })

  it("normalizes realm-specific secrets without emitting the legacy admin alias", () => {
    const inputEnv = {
      DATABASE_URL: "postgres://example.test/voyant",
      BETTER_AUTH_SECRET: " legacy-secret-must-be-removed ",
      BETTER_AUTH_ADMIN_SECRET: " admin-secret ",
      BETTER_AUTH_CUSTOMER_SECRET: " customer-secret ",
      SESSION_CLAIMS_SECRET: " claims-secret ",
    }
    const env = requireVoyantAuthEnv(inputEnv)

    expect(env).toMatchObject({
      BETTER_AUTH_ADMIN_SECRET: "admin-secret",
      BETTER_AUTH_CUSTOMER_SECRET: "customer-secret",
      SESSION_CLAIMS_SECRET: "claims-secret",
    })
    expect(env).not.toHaveProperty("BETTER_AUTH_SECRET")
  })
})

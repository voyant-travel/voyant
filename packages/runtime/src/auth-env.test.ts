import { describe, expect, it } from "vitest"

import { requireVoyantAuthEnv } from "./auth-env.js"

const ADMIN_AUTH_SECRET = "admin-auth-secret-with-at-least-32-characters"
const ADMIN_CLAIMS_SECRET = "admin-claims-secret-with-at-least-32-characters"
const CUSTOMER_AUTH_SECRET = "customer-auth-secret-with-at-least-32-characters"
const CUSTOMER_CLAIMS_SECRET = "customer-claims-secret-with-at-least-32-characters"

const baseEnv = {
  DATABASE_URL: "postgres://example.test/voyant",
  BETTER_AUTH_ADMIN_SECRET: ` ${ADMIN_AUTH_SECRET} `,
  SESSION_CLAIMS_ADMIN_SECRET: ` ${ADMIN_CLAIMS_SECRET} `,
}

describe("requireVoyantAuthEnv", () => {
  it("rejects admin auth calls until both admin secrets are configured", () => {
    expect(() =>
      requireVoyantAuthEnv({
        DATABASE_URL: "postgres://example.test/voyant",
      }),
    ).toThrow("BETTER_AUTH_ADMIN_SECRET and SESSION_CLAIMS_ADMIN_SECRET")
  })

  it("requires customer realm secrets when customer auth is enabled", () => {
    expect(() => requireVoyantAuthEnv(baseEnv)).toThrow(
      "BETTER_AUTH_CUSTOMER_SECRET and SESSION_CLAIMS_CUSTOMER_SECRET",
    )
  })

  it("allows customer realm secrets to be omitted when customer auth is disabled", () => {
    expect(
      requireVoyantAuthEnv({ ...baseEnv, VOYANT_CUSTOMER_AUTH_MODE: "disabled" }),
    ).toMatchObject({
      BETTER_AUTH_ADMIN_SECRET: ADMIN_AUTH_SECRET,
      SESSION_CLAIMS_ADMIN_SECRET: ADMIN_CLAIMS_SECRET,
      VOYANT_CUSTOMER_AUTH_MODE: "disabled",
    })
  })

  it("rejects short session-claims roots", () => {
    expect(() =>
      requireVoyantAuthEnv({
        ...baseEnv,
        SESSION_CLAIMS_ADMIN_SECRET: "too-short",
        VOYANT_CUSTOMER_AUTH_MODE: "disabled",
      }),
    ).toThrow("at least 32 characters")
  })

  it("rejects shared admin and customer realm roots", () => {
    expect(() =>
      requireVoyantAuthEnv({
        ...baseEnv,
        BETTER_AUTH_CUSTOMER_SECRET: CUSTOMER_AUTH_SECRET,
        SESSION_CLAIMS_CUSTOMER_SECRET: ADMIN_CLAIMS_SECRET,
      }),
    ).toThrow("session-claims secrets must be different")

    expect(() =>
      requireVoyantAuthEnv({
        ...baseEnv,
        BETTER_AUTH_CUSTOMER_SECRET: ADMIN_AUTH_SECRET,
        SESSION_CLAIMS_CUSTOMER_SECRET: CUSTOMER_CLAIMS_SECRET,
      }),
    ).toThrow("Better Auth secrets must be different")
  })

  it("normalizes realm-specific secrets without emitting shared aliases", () => {
    const env = requireVoyantAuthEnv({
      ...baseEnv,
      BETTER_AUTH_SECRET: " legacy-secret-must-be-removed ",
      BETTER_AUTH_CUSTOMER_SECRET: ` ${CUSTOMER_AUTH_SECRET} `,
      SESSION_CLAIMS_SECRET: " shared-claims-must-be-removed ",
      SESSION_CLAIMS_CUSTOMER_SECRET: ` ${CUSTOMER_CLAIMS_SECRET} `,
    } as Parameters<typeof requireVoyantAuthEnv>[0] & Record<string, string>)

    expect(env).toMatchObject({
      BETTER_AUTH_ADMIN_SECRET: ADMIN_AUTH_SECRET,
      BETTER_AUTH_CUSTOMER_SECRET: CUSTOMER_AUTH_SECRET,
      SESSION_CLAIMS_ADMIN_SECRET: ADMIN_CLAIMS_SECRET,
      SESSION_CLAIMS_CUSTOMER_SECRET: CUSTOMER_CLAIMS_SECRET,
    })
    expect(env).not.toHaveProperty("BETTER_AUTH_SECRET")
    expect(env).not.toHaveProperty("SESSION_CLAIMS_SECRET")
  })
})

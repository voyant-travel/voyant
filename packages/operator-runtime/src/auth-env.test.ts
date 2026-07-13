import { describe, expect, it } from "vitest"

import { requireOperatorAuthEnv } from "./auth-env.js"

describe("requireOperatorAuthEnv", () => {
  it("rejects auth calls until both secrets are configured", () => {
    expect(() =>
      requireOperatorAuthEnv({ DATABASE_URL: "postgres://example.test/voyant" }),
    ).toThrow("BETTER_AUTH_SECRET and SESSION_CLAIMS_SECRET")
  })

  it("returns a narrowed environment with normalized secrets", () => {
    expect(
      requireOperatorAuthEnv({
        DATABASE_URL: "postgres://example.test/voyant",
        BETTER_AUTH_SECRET: " better-auth ",
        SESSION_CLAIMS_SECRET: " session-claims ",
      }),
    ).toMatchObject({
      BETTER_AUTH_SECRET: "better-auth",
      SESSION_CLAIMS_SECRET: "session-claims",
    })
  })
})

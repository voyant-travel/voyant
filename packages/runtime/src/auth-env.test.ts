import { describe, expect, it } from "vitest"

import { requireVoyantAuthEnv } from "./auth-env.js"

describe("requireVoyantAuthEnv", () => {
  it("rejects auth calls until both secrets are configured", () => {
    expect(() => requireVoyantAuthEnv({ DATABASE_URL: "postgres://example.test/voyant" })).toThrow(
      "BETTER_AUTH_SECRET and SESSION_CLAIMS_SECRET",
    )
  })

  it("returns a narrowed environment with normalized secrets", () => {
    expect(
      requireVoyantAuthEnv({
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

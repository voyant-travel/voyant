import { describe, expect, it } from "vitest"

import { resourceRequirementsForProvider } from "./deployment-requirements.js"
import { requireNodeAdminBetterAuthSecret } from "./node-auth-secrets.js"

describe("requireNodeAdminBetterAuthSecret", () => {
  it("uses the realm-specific admin secret", () => {
    expect(
      requireNodeAdminBetterAuthSecret({
        BETTER_AUTH_ADMIN_SECRET: " admin-secret ",
      }),
    ).toBe("admin-secret")
  })

  it("rejects an absent realm-specific secret before Better Auth can apply defaults", () => {
    expect(() => requireNodeAdminBetterAuthSecret({})).toThrow(
      "Admin auth requires BETTER_AUTH_ADMIN_SECRET",
    )
    expect(() =>
      requireNodeAdminBetterAuthSecret({
        BETTER_AUTH_ADMIN_SECRET: "  ",
      }),
    ).toThrow("Admin auth requires BETTER_AUTH_ADMIN_SECRET")
  })
})

describe("admin auth deployment requirements", () => {
  it.each([
    "voyant-cloud",
    "better-auth",
  ])("requires only BETTER_AUTH_ADMIN_SECRET for the %s provider", (provider) => {
    const [resource] = resourceRequirementsForProvider("adminAuth", provider)
    const requirement = resource?.env.find(({ name }) => name === "BETTER_AUTH_ADMIN_SECRET")

    expect(requirement).toMatchObject({
      name: "BETTER_AUTH_ADMIN_SECRET",
      required: true,
    })
    expect(requirement?.aliases).toBeUndefined()
  })
})

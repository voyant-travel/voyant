import { describe, expect, it } from "vitest"

import { resourceRequirementsForProvider } from "./deployment-requirements.js"

describe("realm-specific auth deployment requirements", () => {
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

    expect(resource?.env).toContainEqual(
      expect.objectContaining({ name: "SESSION_CLAIMS_ADMIN_SECRET", required: true }),
    )
  })

  it("requires independent Better Auth and claims secrets for customer auth", () => {
    const [resource] = resourceRequirementsForProvider("customerAuth", "better-auth")

    expect(resource?.env).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "BETTER_AUTH_CUSTOMER_SECRET", required: true }),
        expect.objectContaining({ name: "SESSION_CLAIMS_CUSTOMER_SECRET", required: true }),
        expect.objectContaining({ name: "VOYANT_CHECKOUT_CAPABILITY_SECRET", required: true }),
      ]),
    )
  })

  it("requires checkout capabilities even when customer accounts are disabled", () => {
    const [resource] = resourceRequirementsForProvider("customerAuth", "disabled")

    expect(resource?.env).toEqual([
      expect.objectContaining({ name: "VOYANT_CHECKOUT_CAPABILITY_SECRET", required: true }),
    ])
  })
})

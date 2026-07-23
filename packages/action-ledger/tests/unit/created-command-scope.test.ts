import { describe, expect, it } from "vitest"

import { buildCreatedTargetIdempotencyScope } from "../../src/created-command.js"

describe("created-target idempotency scopes", () => {
  it("separates principal realms and organizations while replaying exact scope input", async () => {
    const scope = (principalType: "user" | "agent", organizationId: string | null) =>
      buildCreatedTargetIdempotencyScope({
        actionName: "@voyant-travel/example#action.create-record",
        actionVersion: "v1",
        principalType,
        principalId: "same_raw_id",
        organizationId,
      })

    const [userNoOrg, agentNoOrg, userOrgA, userOrgB] = await Promise.all([
      scope("user", null),
      scope("agent", null),
      scope("user", "org_a"),
      scope("user", "org_b"),
    ])
    expect(new Set([userNoOrg, agentNoOrg, userOrgA, userOrgB]).size).toBe(4)
    expect(await scope("user", null)).toBe(userNoOrg)
  })
})

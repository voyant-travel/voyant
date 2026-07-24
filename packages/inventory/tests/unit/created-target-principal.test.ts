import { buildCreatedTargetIdempotencyScope } from "@voyant-travel/action-ledger"
import { describe, expect, it } from "vitest"

import {
  createdTargetPrincipalId as inventoryPrincipal,
  productContentChangedEventId,
  productCreatedEventId,
} from "../../src/mcp-runtime.js"
import { COMPOSE_PRODUCT_HANDLER_POLICY, CREATE_PRODUCT_HANDLER_POLICY } from "../../src/tools.js"

describe("created-target command principal identity", () => {
  it("uses the ledger-mapped principal", () => {
    expect(inventoryPrincipal({ userId: "user_1", agentId: "agent_1", callerType: "agent" })).toBe(
      "agent_1",
    )
    expect(
      inventoryPrincipal({ userId: "user_1", apiTokenId: "key_1", callerType: "api_key" }),
    ).toBe("key_1")
    expect(
      inventoryPrincipal({
        userId: "user_1",
        workflowPrincipalId: "workflow_1",
        callerType: "workflow",
      }),
    ).toBe("workflow_1")
  })

  it("uses collision-safe event identities derived from the command fingerprint", () => {
    expect(productCreatedEventId("abc")).toBe("evt_inventory_product_created_abc")
    expect(productContentChangedEventId("abc")).toBe("evt_inventory_product_content_changed_abc")
    expect(productCreatedEventId("abc")).not.toBe(productCreatedEventId("def"))
    expect(productCreatedEventId("abc")).not.toBe(productContentChangedEventId("abc"))
  })

  it.each([
    CREATE_PRODUCT_HANDLER_POLICY,
    COMPOSE_PRODUCT_HANDLER_POLICY,
  ])("separates $canonicalName scopes and Tool/action identities", async (policy) => {
    const scope = (organizationId: string | null) =>
      buildCreatedTargetIdempotencyScope({
        actionName: policy.actionPolicy.capabilityId,
        actionVersion: policy.actionPolicy.version,
        principalType: "user",
        principalId: "same",
        organizationId,
      })
    expect(await scope(null)).not.toBe(await scope("org_1"))
    expect(policy.capabilityId).not.toBe(policy.actionPolicy.capabilityId)
  })
})

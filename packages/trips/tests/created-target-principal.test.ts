import { buildCreatedTargetIdempotencyScope } from "@voyant-travel/action-ledger"
import { expect, it } from "vitest"
import { createdTargetPrincipalId } from "../src/mcp-runtime.js"
import { CREATE_TRIP_HANDLER_POLICY } from "../src/tools.js"

it("maps mixed trip command identity through the ledger", () => {
  expect(
    createdTargetPrincipalId({ userId: "user_1", apiTokenId: "key_1", callerType: "api_key" }),
  ).toBe("key_1")
})

it("separates trip command scopes across principal realms", async () => {
  const scope = (principalType: "user" | "agent") =>
    buildCreatedTargetIdempotencyScope({
      actionName: CREATE_TRIP_HANDLER_POLICY.actionPolicy.capabilityId,
      actionVersion: CREATE_TRIP_HANDLER_POLICY.actionPolicy.version,
      principalType,
      principalId: "same",
      organizationId: null,
    })
  expect(await scope("user")).not.toBe(await scope("agent"))
  expect(CREATE_TRIP_HANDLER_POLICY.capabilityId).not.toBe(
    CREATE_TRIP_HANDLER_POLICY.actionPolicy.capabilityId,
  )
})

import { buildCreatedTargetIdempotencyScope } from "@voyant-travel/action-ledger"
import { expect, it } from "vitest"
import { createdTargetPrincipalId } from "../src/mcp-runtime.js"
import { CREATE_PROGRAM_HANDLER_POLICY } from "../src/tools.js"

it("maps mixed MICE command identity through the ledger", () => {
  expect(
    createdTargetPrincipalId({ userId: "user_1", agentId: "agent_1", callerType: "agent" }),
  ).toBe("agent_1")
})

it("separates MICE command scopes across organizations", async () => {
  const scope = (organizationId: string | null) =>
    buildCreatedTargetIdempotencyScope({
      actionName: CREATE_PROGRAM_HANDLER_POLICY.actionPolicy.capabilityId,
      actionVersion: CREATE_PROGRAM_HANDLER_POLICY.actionPolicy.version,
      principalType: "user",
      principalId: "same",
      organizationId,
    })
  expect(await scope(null)).not.toBe(await scope("org_1"))
  expect(CREATE_PROGRAM_HANDLER_POLICY.capabilityId).not.toBe(
    CREATE_PROGRAM_HANDLER_POLICY.actionPolicy.capabilityId,
  )
})

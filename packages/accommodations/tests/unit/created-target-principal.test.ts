import { buildCreatedTargetIdempotencyScope } from "@voyant-travel/action-ledger"
import { expect, it } from "vitest"
import { createdTargetPrincipalId } from "../../src/mcp-runtime.js"
import { CREATE_ROOM_BLOCK_HANDLER_POLICY } from "../../src/tools.js"

it("maps mixed room-block command identity through the ledger", () => {
  expect(
    createdTargetPrincipalId({
      userId: "user_1",
      workflowPrincipalId: "wf_1",
      callerType: "workflow",
    }),
  ).toBe("wf_1")
})

it("separates room-block command scopes across organizations", async () => {
  const scope = (organizationId: string | null) =>
    buildCreatedTargetIdempotencyScope({
      actionName: CREATE_ROOM_BLOCK_HANDLER_POLICY.actionPolicy.capabilityId,
      actionVersion: CREATE_ROOM_BLOCK_HANDLER_POLICY.actionPolicy.version,
      principalType: "workflow",
      principalId: "same",
      organizationId,
    })
  expect(await scope(null)).not.toBe(await scope("org_1"))
  expect(CREATE_ROOM_BLOCK_HANDLER_POLICY.capabilityId).not.toBe(
    CREATE_ROOM_BLOCK_HANDLER_POLICY.actionPolicy.capabilityId,
  )
})

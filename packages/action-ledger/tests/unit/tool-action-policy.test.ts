import type { VoyantGraphActionDeclaration } from "@voyant-travel/core/project"
import type { ToolActionPolicyExecutionInput, ToolActionPolicyManifest } from "@voyant-travel/tools"
import { afterEach, describe, expect, it, vi } from "vitest"

import { buildActionApprovalCommandFingerprint } from "../../src/fingerprint.js"
import { actionLedgerService } from "../../src/service.js"
import { createToolActionPolicyGate } from "../../src/tool-action-policy.js"

const requestContext = {
  actor: "staff",
  callerType: "agent",
  agentId: "agent_1",
}

afterEach(() => vi.restoreAllMocks())

describe("generic MCP action-policy gate", () => {
  it("permits an optional-ledger read through the selected action", async () => {
    const selected = action({ kind: "read", ledger: "optional", risk: "low" })
    const gate = createToolActionPolicyGate({
      db: {} as never,
      selectedActions: [selected],
      requestContext,
    })
    const dispatch = vi.fn(async () => ({ ok: true }))

    await expect(gate.execute(execution(selected, {}), dispatch)).resolves.toEqual({ ok: true })
    expect(dispatch).toHaveBeenCalledOnce()
  })

  it("fails closed when a read action claims an unsupported approval policy", async () => {
    const selected = action({ kind: "read", ledger: "optional", approval: "required" })
    const gate = createToolActionPolicyGate({
      db: {} as never,
      selectedActions: [selected],
      requestContext,
    })
    const dispatch = vi.fn(async () => ({ ok: true }))

    await expect(gate.execute(execution(selected, {}), dispatch)).rejects.toMatchObject({
      code: "APPROVAL_REQUIRED",
    })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it("writes a required-ledger preflight before dispatch and records success", async () => {
    const selected = action()
    const events: string[] = []
    let sequence = 0
    vi.spyOn(actionLedgerService, "appendEntry").mockImplementation(async (_db, input) => {
      events.push(`ledger:${input.status}`)
      sequence += 1
      return { entry: { id: `action_${sequence}`, ...input }, replayed: false } as never
    })
    const gate = createToolActionPolicyGate({
      db: {} as never,
      selectedActions: [selected],
      requestContext,
    })

    const result = await gate.execute(
      execution(selected, {
        confirmed: true,
        targetId: "target_1",
        idempotencyKey: "command_1",
      }),
      async () => {
        events.push("dispatch")
        return { ok: true }
      },
    )

    expect(result).toEqual({ ok: true })
    expect(events).toEqual(["ledger:requested", "dispatch", "ledger:succeeded"])
  })

  it("requires confirmation, approval, and a client-carried exact fingerprint", async () => {
    const selected = action({ approval: "required" })
    const gate = createToolActionPolicyGate({
      db: {} as never,
      selectedActions: [selected],
      requestContext,
    })
    const dispatch = vi.fn(async () => ({ ok: true }))

    await expect(
      gate.execute(
        execution(selected, { targetId: "target_1", idempotencyKey: "command_1" }),
        dispatch,
      ),
    ).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" })
    await expect(
      gate.execute(
        execution(selected, {
          confirmed: true,
          targetId: "target_1",
          idempotencyKey: "command_1",
          idempotencyFingerprint: "sha256:present",
        }),
        dispatch,
      ),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" })
    await expect(
      gate.execute(
        execution(selected, {
          confirmed: true,
          targetId: "target_1",
          idempotencyKey: "command_1",
          approvalId: "approval_1",
        }),
        dispatch,
      ),
    ).rejects.toMatchObject({ code: "ACTION_POLICY_REQUIRED" })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it("rejects a wrong fingerprint and a principal-mismatched approval without dispatch", async () => {
    const selected = action({ approval: "required" })
    const gate = createToolActionPolicyGate({
      db: {} as never,
      selectedActions: [selected],
      requestContext,
    })
    const dispatch = vi.fn(async () => ({ ok: true }))

    await expect(
      gate.execute(
        execution(selected, {
          confirmed: true,
          targetId: "target_1",
          idempotencyKey: "command_1",
          approvalId: "approval_1",
          idempotencyFingerprint: "sha256:wrong",
        }),
        dispatch,
      ),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_DENIED" })

    const fingerprint = await exactFingerprint(selected, { value: 1 })
    vi.spyOn(actionLedgerService, "validateApprovedAction").mockResolvedValue({
      ok: false,
      reason: "principal_mismatch",
    })
    await expect(
      gate.execute(
        execution(
          selected,
          {
            confirmed: true,
            targetId: "target_1",
            idempotencyKey: "command_1",
            approvalId: "approval_1",
            idempotencyFingerprint: fingerprint,
          },
          { value: 1 },
        ),
        dispatch,
      ),
    ).rejects.toMatchObject({
      code: "AUTHORIZATION_DENIED",
      meta: { reason: "principal_mismatch" },
    })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it("executes the exact approved command once and records approved causation", async () => {
    const selected = action({ approval: "required" })
    const commandInput = { value: 1 }
    const fingerprint = await exactFingerprint(selected, commandInput)
    vi.spyOn(actionLedgerService, "validateApprovedAction").mockResolvedValue({
      ok: true,
      approval: { id: "approval_1" },
      requestedAction: { id: "requested_1", idempotencyKey: "command_1" },
      idempotencyFingerprint: fingerprint,
    } as never)
    const appended: unknown[] = []
    vi.spyOn(actionLedgerService, "appendEntry").mockImplementation(async (_db, input) => {
      appended.push(input)
      return { entry: { id: `entry_${appended.length}`, ...input }, replayed: false } as never
    })
    const gate = createToolActionPolicyGate({
      db: {} as never,
      selectedActions: [selected],
      requestContext,
    })
    const dispatch = vi.fn(async () => ({ ok: true }))

    await expect(
      gate.execute(
        execution(
          selected,
          {
            confirmed: true,
            targetId: "target_1",
            idempotencyKey: "command_1",
            approvalId: "approval_1",
            idempotencyFingerprint: fingerprint,
          },
          commandInput,
        ),
        dispatch,
      ),
    ).resolves.toEqual({ ok: true })
    expect(dispatch).toHaveBeenCalledOnce()
    expect(appended).toEqual([
      expect.objectContaining({ status: "requested", causationActionId: "requested_1" }),
      expect.objectContaining({
        status: "succeeded",
        causationActionId: "requested_1",
        approvalId: "approval_1",
        idempotencyFingerprint: fingerprint,
      }),
    ])
  })

  it("does not dispatch when the required ledger preflight is unavailable", async () => {
    const selected = action()
    vi.spyOn(actionLedgerService, "appendEntry").mockRejectedValue(new Error("ledger unavailable"))
    const gate = createToolActionPolicyGate({
      db: {} as never,
      selectedActions: [selected],
      requestContext,
    })
    const dispatch = vi.fn(async () => ({ ok: true }))

    await expect(
      gate.execute(
        execution(selected, {
          confirmed: true,
          targetId: "target_1",
          idempotencyKey: "command_1",
        }),
        dispatch,
      ),
    ).rejects.toThrow("ledger unavailable")
    expect(dispatch).not.toHaveBeenCalled()
  })

  it("fails closed before dispatch for a handler-generated target", async () => {
    const selected = action({
      targetLifecycle: "created",
      createdTarget: {
        commandTargetType: "test-create-command",
        resultReferenceType: "test-target-ref",
        durability: "handler-command-claim-v1",
      },
    })
    const gate = createToolActionPolicyGate({
      db: {} as never,
      selectedActions: [selected],
      requestContext,
    })
    const dispatch = vi.fn(async () => ({ id: "generated_1" }))

    await expect(
      gate.execute(
        execution(selected, {
          confirmed: true,
          idempotencyKey: "command_1",
        }),
        dispatch,
      ),
    ).rejects.toMatchObject({
      code: "ACTION_POLICY_REQUIRED",
      message: expect.stringContaining("handler-owned durable command claim"),
    })
    expect(dispatch).not.toHaveBeenCalled()
  })
})

function action(
  overrides: Partial<VoyantGraphActionDeclaration> = {},
): VoyantGraphActionDeclaration {
  return {
    id: "@voyant-travel/test#action.mutate",
    capabilityId: "@voyant-travel/test#action.mutate",
    version: "v1",
    kind: "execute",
    targetType: "test-target",
    risk: "high",
    ledger: "required",
    approval: "never",
    allowedActorTypes: ["staff"],
    from: { tools: ["@voyant-travel/test#tool.mutate"] },
    ...overrides,
  }
}

function execution(
  selected: VoyantGraphActionDeclaration,
  invocation: ToolActionPolicyExecutionInput["invocation"],
  commandInput: unknown = { value: 1 },
): ToolActionPolicyExecutionInput {
  const actionPolicy: ToolActionPolicyManifest = {
    id: selected.id,
    capabilityId: selected.capabilityId ?? selected.id,
    version: selected.version,
    kind: selected.kind,
    targetType: selected.targetType,
    risk: selected.risk,
    ledger: selected.ledger,
    approval: selected.approval ?? "never",
    targetLifecycle: selected.targetLifecycle ?? "existing",
    ...(selected.createdTarget ? { createdTarget: selected.createdTarget } : {}),
    allowedActorTypes: selected.allowedActorTypes,
    enforcement: "generic",
    invocation: {
      controlField: "_voyant",
      requiredFields: [],
      optionalFields: ["reasonCode", "approvalId", "idempotencyFingerprint"],
      fingerprintAlgorithm: "action-ledger-command-v1",
    },
  }
  if (selected.kind === "execute") actionPolicy.invocation.requiredFields = ["confirmed"]
  return {
    capabilityId: "@voyant-travel/test#tool.mutate",
    capabilityVersion: "v1",
    canonicalName: "mutate_test",
    actionPolicy,
    commandInput,
    invocation,
  }
}

function exactFingerprint(selected: VoyantGraphActionDeclaration, commandInput: unknown) {
  return buildActionApprovalCommandFingerprint({
    actionName: selected.capabilityId ?? selected.id,
    actionVersion: selected.version,
    targetType: selected.targetType,
    targetId: "target_1",
    commandInput,
    approvalPolicy: "required",
    capabilityId: selected.capabilityId ?? selected.id,
    capabilityVersion: selected.version,
    evaluatedRisk: selected.risk,
    reasonCode: null,
  })
}

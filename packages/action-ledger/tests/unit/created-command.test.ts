import type { AnyDrizzleDb } from "@voyant-travel/db"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ActionLedgerCreatedCommandApprovalError,
  ActionLedgerCreatedCommandFingerprintMismatchError,
  ActionLedgerCreatedCommandProtocolError,
  ActionLedgerCreatedCommandReplayCorruptError,
  ActionLedgerCreatedCommandReplayIncompleteError,
  ActionLedgerCreatedCommandTransactionRequiredError,
  buildCreatedTargetCommandFingerprint,
  buildCreatedTargetIdempotencyScope,
  type ExecuteCreatedTargetCommandInput,
  executeAdmittedCreatedTargetCommand,
  executeCreatedTargetCommand,
} from "../../src/created-command.js"
import type {
  ActionLedgerEntry,
  ActionMutationDetail,
  NewActionLedgerEntry,
  NewActionMutationDetail,
} from "../../src/schema.js"
import { actionLedgerEntries, actionMutationDetails } from "../../src/schema.js"
import { ActionLedgerIdempotencyConflictError, actionLedgerService } from "../../src/service.js"
import { makeApproval, makeEntry, makeMutationDetail } from "./service-fixtures.js"

afterEach(() => vi.restoreAllMocks())

const POLICY_DRIFTS: Array<[string, Partial<ExecuteCreatedTargetCommandInput>]> = [
  ["capability", { capabilityId: "relationships:person:create:v2" }],
  ["capability version", { capabilityVersion: "v2" }],
  ["risk", { evaluatedRisk: "critical" }],
  ["approval", { approvalPolicy: "conditional" }],
  ["reason", { approvalReasonCode: "different_reason" }],
  ["canonical target", { canonicalTargetType: "relationship-organization" }],
  ["reference type", { resultReferenceType: "wrong-ref" }],
  [
    "parent anchor",
    { parentAnchor: { targetType: "organization", targetIdField: "organizationId" } },
  ],
]

describe("created-target command protocol", () => {
  it("uses admitted graph identity, Tool route identity, and replays the canonical child reference", async () => {
    const harness = makeCreatedCommandDb()
    const actionName = "inventory:product-extra:create"
    const actionVersion = "v1"
    const scope = await buildCreatedTargetIdempotencyScope({
      actionName,
      actionVersion,
      principalType: "user",
      principalId: "usr_1",
      organizationId: "org_1",
    })
    ;(harness.db as AnyDrizzleDb & { __claimScope?: string }).__claimScope =
      `${scope}:created-command-claim`
    const create = vi.fn(async () => ({
      value: { id: "extra_1", replayed: false },
      targetId: "extra_1",
    }))
    const admitted = makeAdmittedCreatedTargetContext({ actionName, actionVersion })
    const execute = () =>
      executeAdmittedCreatedTargetCommand(
        {
          db: harness.db,
          context: {
            userId: "usr_1",
            organizationId: "org_1",
            actor: "staff",
            callerType: "session",
          },
          admitted,
          idempotencyKey: "key_1",
          commandTargetType: "product-extra-create-command",
          canonicalTargetType: "product_extra",
          resultReferenceType: "product_extra",
          commandInput: { productId: "product_1", name: "Transfer" },
          evaluatedRisk: "high",
        },
        {
          create,
          async replay(_tx, completed) {
            return { id: completed.reference.id, replayed: true }
          },
        },
      )

    await expect(execute()).resolves.toMatchObject({
      replayed: false,
      value: { id: "extra_1", replayed: false },
    })
    await expect(execute()).resolves.toMatchObject({
      replayed: true,
      value: { id: "extra_1", replayed: true },
    })
    expect(create).toHaveBeenCalledTimes(1)
    expect(harness.entries[0]).toMatchObject({
      actionName,
      capabilityId: actionName,
      capabilityVersion: actionVersion,
      routeOrToolName: admitted.capabilityId,
      organizationId: "org_1",
    })

    await expect(
      executeAdmittedCreatedTargetCommand(
        {
          db: harness.db,
          context: {
            userId: "usr_1",
            organizationId: "org_1",
            actor: "staff",
            callerType: "session",
          },
          admitted: {
            ...admitted,
            actionPolicy: { ...admitted.actionPolicy, approval: "required" as const },
          },
          idempotencyKey: "key_2",
          commandTargetType: "product-extra-create-command",
          canonicalTargetType: "product_extra",
          resultReferenceType: "product_extra",
          commandInput: { productId: "product_1", name: "Transfer" },
          evaluatedRisk: "high",
        },
        {
          create,
          async replay(_tx, completed) {
            return { id: completed.reference.id, replayed: true }
          },
        },
      ),
    ).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandProtocolError.name,
      reason: "admitted_policy_mismatch",
    })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["non-handler enforcement", { enforcement: "generic" as const }, { idempotencyKey: "key_1" }],
    ["optional ledger", { ledger: "optional" as const }, { idempotencyKey: "key_1" }],
    ["non-execute kind", { kind: "read" as const }, { idempotencyKey: "key_1" }],
    ["different admitted key", {}, { idempotencyKey: "key_other" }],
  ])("rejects %s before opening a transaction", async (_label, policyPatch, invocation) => {
    const harness = makeCreatedCommandDb()
    const create = vi.fn()
    const admitted = makeAdmittedCreatedTargetContext()

    await expect(
      executeAdmittedCreatedTargetCommand(
        {
          db: harness.db,
          context: {
            userId: "usr_1",
            organizationId: "org_1",
            actor: "staff",
            callerType: "session",
          },
          admitted: {
            ...admitted,
            actionPolicy: { ...admitted.actionPolicy, ...policyPatch },
            invocation,
          },
          idempotencyKey: "key_1",
          commandTargetType: "product-extra-create-command",
          canonicalTargetType: "product_extra",
          resultReferenceType: "product_extra",
          commandInput: { productId: "product_1", name: "Transfer" },
          evaluatedRisk: "high",
        },
        { create, replay: vi.fn() },
      ),
    ).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandProtocolError.name,
      reason: "admitted_policy_mismatch",
    })
    expect(harness.events).toEqual([])
    expect(create).not.toHaveBeenCalled()
  })

  it.each([
    ["missing parent", { name: "Transfer" }],
    ["blank parent", { productId: "  ", name: "Transfer" }],
  ])("rejects a %s anchor before opening a transaction", async (_label, commandInput) => {
    const harness = makeCreatedCommandDb()
    const create = vi.fn()

    await expect(
      executeAdmittedCreatedTargetCommand(
        {
          db: harness.db,
          context: {
            userId: "usr_1",
            organizationId: "org_1",
            actor: "staff",
            callerType: "session",
          },
          admitted: makeAdmittedCreatedTargetContext(),
          idempotencyKey: "key_1",
          commandTargetType: "product-extra-create-command",
          canonicalTargetType: "product_extra",
          resultReferenceType: "product_extra",
          commandInput,
          evaluatedRisk: "high",
        },
        { create, replay: vi.fn() },
      ),
    ).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandProtocolError.name,
      reason: "invalid_parent_anchor",
    })
    expect(harness.events).toEqual([])
    expect(create).not.toHaveBeenCalled()
  })

  it("requires both polymorphic and related anchors before opening a transaction", async () => {
    const harness = makeCreatedCommandDb()
    const create = vi.fn()
    const admitted = makeAdmittedCreatedTargetContext()
    const createdTarget = admitted.actionPolicy.createdTarget

    await expect(
      executeAdmittedCreatedTargetCommand(
        {
          db: harness.db,
          context: {
            userId: "usr_1",
            organizationId: "org_1",
            actor: "staff",
            callerType: "session",
          },
          admitted: {
            ...admitted,
            actionPolicy: {
              ...admitted.actionPolicy,
              createdTarget: {
                ...createdTarget,
                parentAnchor: {
                  targetTypeField: "entityType",
                  targetIdField: "entityId",
                  relatedTargetIdField: "optionId",
                },
              },
            },
          },
          idempotencyKey: "key_1",
          commandTargetType: "product-extra-create-command",
          canonicalTargetType: "product_extra",
          resultReferenceType: "product_extra",
          commandInput: { entityType: "product", entityId: "product_1" },
          evaluatedRisk: "high",
        },
        { create, replay: vi.fn() },
      ),
    ).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandProtocolError.name,
      reason: "invalid_parent_anchor",
    })
    expect(harness.events).toEqual([])
    expect(create).not.toHaveBeenCalled()
  })

  it("owns claim, domain mutation, and canonical completion in one transaction", async () => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput()

    const result = await executePersonCommand(harness.db, input)

    expect(result).toMatchObject({
      replayed: false,
      value: { id: "person_1" },
      result: {
        entry: {
          status: "succeeded",
          targetType: "relationship-person",
          targetId: "person_1",
          approvalId: null,
          idempotencyFingerprint: input.idempotency.fingerprint,
        },
        reference: {
          type: "relationship-person-ref",
          id: "person_1",
          value: "relationship-person-ref:person_1",
        },
      },
    })
    const claim = harness.entries.find((entry) => entry.status === "requested")
    expect(claim).toMatchObject({
      targetType: "relationship-person-create-command",
      targetId: "command_1",
      causationActionId: "alge_parent",
      approvalId: null,
    })
    expect(result.result.entry.causationActionId).toBe(claim?.id)
    expect(harness.events).toEqual([
      "begin",
      "advisory-lock",
      "entry:alge_1:requested",
      "detail:alge_1",
      "domain-create",
      "entry:alge_2:succeeded",
      "detail:alge_2",
      "commit",
    ])
  })

  it("rolls back the claim when the child mutation fails", async () => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput()

    await expect(
      executeCreatedTargetCommand(harness.db, input, {
        async create() {
          harness.events.push("domain-create-failed")
          throw new Error("child insert failed")
        },
        async replay(_tx, result) {
          return { id: result.reference.id }
        },
      }),
    ).rejects.toThrow("child insert failed")
    expect(harness.events).toEqual([
      "begin",
      "advisory-lock",
      "entry:alge_1:requested",
      "detail:alge_1",
      "domain-create-failed",
      "rollback",
    ])
    expect(harness.events).not.toContain("commit")
  })

  it("replays the typed result without invoking domain creation twice", async () => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput()
    await executePersonCommand(harness.db, input)

    const replay = await executePersonCommand(harness.db, input)

    expect(replay).toMatchObject({
      replayed: true,
      value: { id: "person_1" },
      result: { reference: { id: "person_1" } },
    })
    expect(harness.events.filter((event) => event === "domain-create")).toHaveLength(1)
    expect(harness.events.filter((event) => event === "domain-replay")).toHaveLength(1)
  })

  it("allows exact retries from a new session, correlation, and workflow step", async () => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput()
    await executePersonCommand(harness.db, input)
    const retry = {
      ...input,
      context: {
        ...input.context,
        sessionId: "session_retry",
        correlationId: "correlation_retry",
        workflowStepId: "step_retry",
      },
    }

    await expect(executePersonCommand(harness.db, retry)).resolves.toMatchObject({
      replayed: true,
      result: {
        entry: {
          sessionId: null,
          correlationId: null,
          workflowStepId: null,
        },
      },
    })
  })

  it.each([
    ["principal", { userId: "usr_other" }],
    ["organization", { organizationId: "org_other" }],
  ])("rejects retry when immutable %s identity changes", async (_label, contextPatch) => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput()
    await executePersonCommand(harness.db, input)

    await expect(
      executePersonCommand(harness.db, {
        ...input,
        context: { ...input.context, ...contextPatch },
      }),
    ).rejects.toMatchObject({
      name: ActionLedgerIdempotencyConflictError.name,
      existingActionId: "alge_1",
    })
  })

  it("uses mapped principal semantics and rejects mismatched caller types", async () => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput({
      context: { agentId: "agent_1", callerType: "session" },
    })

    await expect(executePersonCommand(harness.db, input)).rejects.toThrow(
      "requires a concrete request principal",
    )
    expect(harness.events).toEqual([])
  })

  it("rejects API-key identity when callerType does not select API-key mapping", async () => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput({
      context: { apiTokenId: "key_1", callerType: "agent" },
    })

    await expect(executePersonCommand(harness.db, input)).rejects.toThrow(
      "requires a concrete request principal",
    )
    expect(harness.events).toEqual([])
  })

  it.each(
    POLICY_DRIFTS,
  )("rejects %s drift against the supplied fingerprint", async (_label, patch) => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput()

    await expect(executePersonCommand(harness.db, { ...input, ...patch })).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandFingerprintMismatchError.name,
      receivedFingerprint: input.idempotency.fingerprint,
    })
    expect(harness.events).toEqual([])
  })

  it("conflicts when the same scope/key identifies a different exact command", async () => {
    const harness = makeCreatedCommandDb()
    const first = await makeInput()
    await executePersonCommand(harness.db, first)
    const changed = await makeInput({ commandInput: { displayName: "Different person" } })

    await expect(executePersonCommand(harness.db, changed)).rejects.toMatchObject({
      name: ActionLedgerIdempotencyConflictError.name,
      existingActionId: "alge_1",
    })
  })

  it("rejects replay when the stored claim tenant identity drifts", async () => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput()
    await executePersonCommand(harness.db, input)
    const claim = harness.entries.find((entry) => entry.status === "requested")
    if (!claim) throw new Error("missing claim")
    claim.organizationId = "org_other"

    await expect(executePersonCommand(harness.db, input)).rejects.toMatchObject({
      name: ActionLedgerIdempotencyConflictError.name,
      existingActionId: claim.id,
    })
  })

  it("re-reads the opaque claim and fails if domain code changes it", async () => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput()

    await expect(
      executeCreatedTargetCommand(harness.db, input, {
        async create() {
          const claim = harness.entries.find((entry) => entry.status === "requested")
          if (!claim) throw new Error("missing claim")
          claim.organizationId = "org_tampered"
          return { value: { id: "person_1" }, targetId: "person_1" }
        },
        async replay(_tx, result) {
          return { id: result.reference.id }
        },
      }),
    ).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandProtocolError.name,
      reason: "claim_changed_during_mutation",
    })
  })

  it("fails closed if domain code manufactures a result during creation", async () => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput()

    await expect(
      executeCreatedTargetCommand(harness.db, input, {
        async create() {
          const claim = harness.entries.find((entry) => entry.status === "requested")
          if (!claim) throw new Error("missing claim")
          harness.entries.push(
            makeEntry({
              ...claim,
              id: "alge_forged_result",
              status: "succeeded",
              targetType: "relationship-person",
              targetId: "person_1",
              causationActionId: claim.id,
              idempotencyScope: resultScope(input.idempotency.scope),
            }),
          )
          return { value: { id: "person_1" }, targetId: "person_1" }
        },
        async replay(_tx, result) {
          return { id: result.reference.id }
        },
      }),
    ).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandProtocolError.name,
      reason: "result_created_during_mutation",
    })
  })

  it.each([
    ["organizationId", "org_other"],
    ["principalId", "usr_other"],
    ["approvalId", "appr_other"],
    ["capabilityVersion", "v2"],
    ["authorizationSource", "other_source"],
    ["workflowRunId", "workflow_other"],
    ["causationActionId", "alge_other_claim"],
  ] as const)("validates immutable replay continuity for %s", async (field, value) => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput()
    const first = await executePersonCommand(harness.db, input)
    Object.assign(first.result.entry, { [field]: value })

    await expect(executePersonCommand(harness.db, input)).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandReplayCorruptError.name,
      resultActionId: first.result.entry.id,
      reason: "result_identity_mismatch",
    })
  })

  it.each([
    ["leading", "relationship-person-ref: person_1"],
    ["trailing", "relationship-person-ref:person_1 "],
  ])("rejects %s result-reference id whitespace as noncanonical", async (_label, value) => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput()
    const first = await executePersonCommand(harness.db, input)
    const detail = harness.mutationDetails.find((row) => row.actionId === first.result.entry.id)
    if (!detail) throw new Error("missing canonical result detail")
    detail.commandResultRef = value

    await expect(executePersonCommand(harness.db, input)).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandReplayCorruptError.name,
      resultActionId: first.result.entry.id,
      reason: "malformed_result_reference",
    })
  })

  it("distinguishes a committed claim with no canonical result", async () => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput()
    await executePersonCommand(harness.db, input)
    harness.entries.splice(
      harness.entries.findIndex((entry) => entry.status === "succeeded"),
      1,
    )

    await expect(executePersonCommand(harness.db, input)).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandReplayIncompleteError.name,
      claimActionId: "alge_1",
    })
  })

  it("requires a transaction-capable database before claiming", async () => {
    const input = await makeInput()

    await expect(executePersonCommand({} as AnyDrizzleDb, input)).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandTransactionRequiredError.name,
    })
  })

  it("validates an approved request before mutation, links causation, and exactly replays", async () => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput({ approvalPolicy: "required" })
    mockApprovedCommand(input)

    const first = await executePersonCommand(harness.db, input)
    const replay = await executePersonCommand(harness.db, input)

    expect(first.result.entry).toMatchObject({
      approvalId: "appr_created",
      causationActionId: "alge_1",
    })
    const claim = harness.entries.find((entry) => entry.status === "requested")
    expect(claim).toMatchObject({
      approvalId: "appr_created",
      causationActionId: "alge_requested",
    })
    expect(replay.replayed).toBe(true)
    expect(harness.events.filter((event) => event === "domain-create")).toHaveLength(1)
    expect(actionLedgerService.validateApprovedAction).toHaveBeenNthCalledWith(
      1,
      harness.db,
      expect.objectContaining({
        capabilityId: input.capabilityId,
        capabilityVersion: input.capabilityVersion,
        evaluatedRisk: input.evaluatedRisk,
        policyName: input.approvalPolicyName,
        policyVersion: input.actionVersion,
        reasonCode: input.approvalReasonCode,
        idempotencyKey: input.idempotency.key,
        targetType: input.commandTarget.type,
        targetId: input.commandTarget.id,
      }),
    )
    expect(actionLedgerService.validateApprovedAction).toHaveBeenCalledTimes(1)
    expect(actionLedgerService.getApproval).toHaveBeenCalledWith(harness.db, "appr_created")
  })

  it("uses one approval only once when the same exact command changes idempotency scope", async () => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput({ approvalPolicy: "required" })
    mockApprovedCommand(input)
    await executePersonCommand(harness.db, input)

    await expect(
      executePersonCommand(harness.db, {
        ...input,
        idempotency: { ...input.idempotency, scope: "relationships.create_person:other-scope" },
      }),
    ).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandApprovalError.name,
      reason: "already_executed",
    })
    expect(harness.events.filter((event) => event === "domain-create")).toHaveLength(1)
  })

  it.each([
    "expired",
    "principal_mismatch",
    "risk_mismatch",
  ] as const)("rejects %s approval validation before domain mutation", async (reason) => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput({ approvalPolicy: "required" })
    vi.spyOn(actionLedgerService, "validateApprovedAction").mockResolvedValue({
      ok: false,
      reason,
    })

    await expect(executePersonCommand(harness.db, input)).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandApprovalError.name,
      approvalId: "appr_created",
      reason,
    })
    expect(harness.events).toEqual(["begin", "advisory-lock", "advisory-lock", "rollback"])
    expect(harness.events).not.toContain("domain-create")
  })

  it("rejects direct approval or causation fields instead of trusting forged linkage", async () => {
    const harness = makeCreatedCommandDb()
    const input = await makeInput({ approvalPolicy: "required" })

    await expect(
      executePersonCommand(harness.db, { ...input, approvalId: "appr_forged" }),
    ).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandProtocolError.name,
      reason: "forged_approval_linkage",
    })
    await expect(
      executePersonCommand(harness.db, { ...input, causationActionId: "alge_forged" }),
    ).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandProtocolError.name,
      reason: "forged_approval_linkage",
    })
    expect(harness.events).toEqual([])
  })
})

function makeAdmittedCreatedTargetContext(
  input: { actionName?: string; actionVersion?: string } = {},
) {
  const actionName = input.actionName ?? "inventory:product-extra:create"
  const actionVersion = input.actionVersion ?? "v1"
  return {
    capabilityId: "@voyant-travel/inventory#extras.tool.create-product-extra",
    capabilityVersion: "v1",
    canonicalName: "create_product_extra",
    actionPolicy: {
      id: actionName,
      capabilityId: actionName,
      version: actionVersion,
      kind: "execute" as const,
      targetType: "product_extra",
      targetLifecycle: "created" as const,
      createdTarget: {
        commandTargetType: "product-extra-create-command",
        resultReferenceType: "product_extra",
        durability: "handler-command-claim-v1" as const,
        parentAnchor: { targetType: "product", targetIdField: "productId" },
      },
      risk: "high" as const,
      ledger: "required" as const,
      approval: "never" as const,
      reversible: false,
      enforcement: "handler" as const,
      invocation: {
        controlField: "_voyant" as const,
        requiredFields: ["idempotencyKey"] as const,
        optionalFields: [] as const,
        fingerprintAlgorithm: "action-ledger-command-v1" as const,
      },
    },
    invocation: { idempotencyKey: "key_1" },
  }
}

async function executePersonCommand(db: AnyDrizzleDb, input: ExecuteCreatedTargetCommandInput) {
  const harness = db as AnyDrizzleDb & { __claimScope?: string }
  harness.__claimScope = `${input.idempotency.scope}:created-command-claim`
  return executeCreatedTargetCommand(db, input, {
    async create() {
      const harness = db as AnyDrizzleDb & { __events?: string[] }
      harness.__events?.push("domain-create")
      return { value: { id: "person_1" }, targetId: "person_1" }
    },
    async replay(_tx, result) {
      const harness = db as AnyDrizzleDb & { __events?: string[] }
      harness.__events?.push("domain-replay")
      return { id: result.reference.id }
    },
  })
}

async function makeInput(
  options: {
    context?: ExecuteCreatedTargetCommandInput["context"]
    commandInput?: unknown
    approvalPolicy?: ExecuteCreatedTargetCommandInput["approvalPolicy"]
  } = {},
): Promise<ExecuteCreatedTargetCommandInput> {
  const commandInput = options.commandInput ?? { displayName: "Example person" }
  const fingerprintInput = {
    actionName: "relationship.person.create",
    actionVersion: "v1",
    commandTarget: {
      type: "relationship-person-create-command",
      id: "command_1",
    },
    canonicalTargetType: "relationship-person",
    resultReferenceType: "relationship-person-ref",
    commandInput,
    capabilityId: "relationships:person:create",
    capabilityVersion: "v1",
    evaluatedRisk: "high" as const,
    approvalPolicy: options.approvalPolicy ?? ("none" as const),
    approvalReasonCode: "agent_created_person",
  }
  const fingerprint = await buildCreatedTargetCommandFingerprint(fingerprintInput)
  const approvalRequired = fingerprintInput.approvalPolicy === "required"
  return {
    context:
      options.context ??
      ({
        userId: "usr_1",
        callerType: "session",
        actor: "staff",
        organizationId: "org_1",
        workflowRunId: "workflow_1",
      } satisfies ExecuteCreatedTargetCommandInput["context"]),
    ...fingerprintInput,
    routeOrToolName: "relationships.create_person",
    authorizationSource: "relationships.create_person.handler",
    ...(approvalRequired
      ? {
          approvalPolicyName: "relationships-create-policy",
          approvalControls: {
            approvalId: "appr_created",
            idempotencyKey: "idem_1",
            idempotencyFingerprint: fingerprint,
            reasonCode: "agent_created_person",
          },
        }
      : { causationActionId: "alge_parent" }),
    idempotency: {
      scope: "relationships.create_person:usr_1",
      key: "idem_1",
      fingerprint,
    },
  }
}

function mockApprovedCommand(input: ExecuteCreatedTargetCommandInput) {
  const result = {
    ok: true,
    approval: makeApproval({
      id: "appr_created",
      requestedActionId: "alge_requested",
      status: "approved",
      requestedByPrincipalId: "usr_1",
      assignedToPrincipalId: "usr_approver",
      decidedByPrincipalId: "usr_approver",
      policyName: "relationships-create-policy",
      policyVersion: "v1",
      riskSnapshot: "high",
      reasonCode: input.approvalReasonCode,
      expiresAt: null,
    }),
    requestedAction: makeEntry({
      id: "alge_requested",
      actionName: input.actionName,
      actionVersion: input.actionVersion,
      actionKind: "execute",
      status: "awaiting_approval",
      evaluatedRisk: input.evaluatedRisk,
      principalType: "user",
      principalId: "usr_1",
      targetType: input.commandTarget.type,
      targetId: input.commandTarget.id,
      routeOrToolName: input.routeOrToolName ?? null,
      capabilityId: input.capabilityId,
      capabilityVersion: input.capabilityVersion,
      approvalId: "appr_created",
      idempotencyKey: input.idempotency.key,
      idempotencyFingerprint: input.idempotency.fingerprint,
    }),
    idempotencyFingerprint: input.idempotency.fingerprint,
  } as const
  vi.spyOn(actionLedgerService, "getApproval").mockResolvedValue({
    approval: result.approval,
    requestedAction: {
      entry: result.requestedAction,
      mutationDetail: null,
      sensitiveReadDetail: null,
      payloads: [],
    },
  })
  return vi.spyOn(actionLedgerService, "validateApprovedAction").mockResolvedValue(result)
}

function makeCreatedCommandDb() {
  const entries: ActionLedgerEntry[] = []
  const mutationDetails: ActionMutationDetail[] = []
  const events: string[] = []

  const db = {
    __events: events,
    __claimScope: "relationships.create_person:usr_1:created-command-claim",
    async transaction<T>(callback: (tx: AnyDrizzleDb) => Promise<T>) {
      events.push("begin")
      try {
        const result = await callback(db as unknown as AnyDrizzleDb)
        events.push("commit")
        return result
      } catch (error) {
        events.push("rollback")
        throw error
      }
    },
    execute() {
      events.push("advisory-lock")
      return Promise.resolve([])
    },
    select(selection?: Record<string, unknown>) {
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                limit() {
                  if (table === actionLedgerEntries && selection && "claim" in selection) {
                    const claim = entries.find(
                      (entry) => entry.idempotencyScope === db.__claimScope,
                    )
                    return Promise.resolve(claim ? [{ claim }] : [])
                  }
                  if (table === actionLedgerEntries && selection && "approvedClaim" in selection) {
                    const approvedClaim = entries.find((entry) => entry.status === "requested")
                    return Promise.resolve(approvedClaim ? [{ approvedClaim }] : [])
                  }
                  if (table === actionLedgerEntries && selection && "result" in selection) {
                    const result = entries.find((entry) =>
                      entry.idempotencyScope?.endsWith(":created-command-result"),
                    )
                    return Promise.resolve(result ? [{ result }] : [])
                  }
                  if (
                    table === actionMutationDetails &&
                    selection &&
                    "commandResultRef" in selection
                  ) {
                    const result = entries.find((entry) =>
                      entry.idempotencyScope?.endsWith(":created-command-result"),
                    )
                    const detail = mutationDetails.find((row) => row.actionId === result?.id)
                    return Promise.resolve(
                      detail ? [{ commandResultRef: detail.commandResultRef }] : [],
                    )
                  }
                  return Promise.resolve([])
                },
              }
            },
          }
        },
      }
    },
    insert(table: unknown) {
      return {
        values(values: NewActionLedgerEntry | NewActionMutationDetail) {
          if (table === actionLedgerEntries) {
            return {
              returning() {
                const input = values as NewActionLedgerEntry
                const entry = makeEntry({
                  ...input,
                  id: `alge_${entries.length + 1}`,
                  occurredAt: input.occurredAt ?? new Date("2026-07-23T10:00:00.000Z"),
                  createdAt: new Date("2026-07-23T10:00:00.000Z"),
                  actorType: input.actorType ?? null,
                  principalSubtype: input.principalSubtype ?? null,
                  sessionId: input.sessionId ?? null,
                  apiTokenId: input.apiTokenId ?? null,
                  delegatedByPrincipalType: input.delegatedByPrincipalType ?? null,
                  delegatedByPrincipalId: input.delegatedByPrincipalId ?? null,
                  delegationId: input.delegationId ?? null,
                  callerType: input.callerType ?? null,
                  organizationId: input.organizationId ?? null,
                  routeOrToolName: input.routeOrToolName ?? null,
                  workflowRunId: input.workflowRunId ?? null,
                  workflowStepId: input.workflowStepId ?? null,
                  correlationId: input.correlationId ?? null,
                  causationActionId: input.causationActionId ?? null,
                  idempotencyScope: input.idempotencyScope ?? null,
                  idempotencyKey: input.idempotencyKey ?? null,
                  idempotencyFingerprint: input.idempotencyFingerprint ?? null,
                  capabilityId: input.capabilityId ?? null,
                  capabilityVersion: input.capabilityVersion ?? null,
                  authorizationSource: input.authorizationSource ?? null,
                  approvalId: input.approvalId ?? null,
                  amendsActionId: input.amendsActionId ?? null,
                })
                entries.push(entry)
                events.push(`entry:${entry.id}:${entry.status}`)
                return Promise.resolve([entry])
              },
            }
          }
          const input = values as NewActionMutationDetail
          const detail = makeMutationDetail({
            ...input,
            commandInputRef: input.commandInputRef ?? null,
            commandResultRef: input.commandResultRef ?? null,
            summary: input.summary ?? null,
            reversalKind: input.reversalKind ?? "none",
          })
          mutationDetails.push(detail)
          events.push(`detail:${detail.actionId}`)
          return {}
        },
      }
    },
  } as unknown as AnyDrizzleDb & { __events: string[] }

  return { db, entries, mutationDetails, events }
}

function resultScope(scope: string): string {
  return `${scope}:created-command-result`
}

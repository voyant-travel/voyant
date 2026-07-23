import type { AnyDrizzleDb } from "@voyant-travel/db"
import { describe, expect, it } from "vitest"

import {
  ActionLedgerCreatedCommandFingerprintMismatchError,
  ActionLedgerCreatedCommandReplayCorruptError,
  ActionLedgerCreatedCommandReplayIncompleteError,
  buildCreatedTargetCommandFingerprint,
  claimCreatedTargetCommand,
  completeCreatedTargetCommand,
  type ClaimCreatedTargetCommandInput,
} from "../../src/created-command.js"
import type {
  ActionLedgerEntry,
  ActionMutationDetail,
  NewActionLedgerEntry,
  NewActionMutationDetail,
} from "../../src/schema.js"
import { actionLedgerEntries, actionMutationDetails } from "../../src/schema.js"
import { ActionLedgerIdempotencyConflictError } from "../../src/service.js"
import { makeEntry, makeMutationDetail } from "./service-fixtures.js"

describe("created-target command protocol", () => {
  it("locks and appends the requested command claim before domain mutation", async () => {
    const harness = makeCreatedCommandDb()
    const baseInput = await makeInput()

    const claimed = await claimCreatedTargetCommand(harness.db, baseInput)
    harness.events.push("domain-mutation")
    const completed = await completeCreatedTargetCommand(harness.db, {
      claim: claimed.claim,
      targetId: "person_1",
      mutationDetail: {
        summary: "Person created",
        reversalKind: "domain_command",
        reversalCommandId: "relationship.person.delete",
        reversalCommandVersion: "v1",
      },
    })

    expect(claimed).toMatchObject({
      replayed: false,
      result: null,
      claim: {
        entry: {
          status: "requested",
          targetType: "relationship-person-create-command",
          targetId: "command_1",
          approvalId: "appr_1",
          causationActionId: "alge_approved_request",
          idempotencyScope: claimScope("relationships.create_person:usr_1"),
          idempotencyKey: "idem_1",
          idempotencyFingerprint: baseInput.idempotency.fingerprint,
        },
      },
    })
    expect(completed).toMatchObject({
      replayed: false,
      entry: {
        status: "succeeded",
        targetType: "relationship-person",
        targetId: "person_1",
        causationActionId: claimed.claim.entry.id,
        approvalId: "appr_1",
        idempotencyScope: resultScope("relationships.create_person:usr_1"),
        idempotencyKey: "idem_1",
        idempotencyFingerprint: baseInput.idempotency.fingerprint,
      },
      reference: {
        type: "relationship-person-ref",
        id: "person_1",
        value: "relationship-person-ref:person_1",
      },
    })
    expect(harness.events.indexOf(`entry:${claimed.claim.entry.id}:requested`)).toBeLessThan(
      harness.events.indexOf("domain-mutation"),
    )
    expect(harness.mutationDetails.find((row) => row.actionId === completed.entry.id)).toMatchObject(
      {
        commandResultRef: "relationship-person-ref:person_1",
      },
    )
  })

  it("returns canonical result metadata for an exact replay without another insert", async () => {
    const harness = makeCreatedCommandDb()
    const baseInput = await makeInput()
    const first = await claimCreatedTargetCommand(harness.db, baseInput)
    await completeCreatedTargetCommand(harness.db, {
      claim: first.claim,
      targetId: "person_1",
    })
    const entryCount = harness.entries.length

    const replay = await claimCreatedTargetCommand(harness.db, baseInput)

    expect(replay).toMatchObject({
      replayed: true,
      claim: { entry: { id: first.claim.entry.id } },
      result: {
        entry: {
          targetType: "relationship-person",
          targetId: "person_1",
          causationActionId: first.claim.entry.id,
        },
        reference: {
          type: "relationship-person-ref",
          id: "person_1",
          value: "relationship-person-ref:person_1",
        },
      },
    })
    expect(harness.entries).toHaveLength(entryCount)
    expect(harness.advisoryLocks).toHaveLength(2)
  })

  it("rejects the same scope and key when the command fingerprint changes", async () => {
    const harness = makeCreatedCommandDb()
    const baseInput = await makeInput()
    const first = await claimCreatedTargetCommand(harness.db, baseInput)
    const differentCommand = await makeInput({
      commandInput: { displayName: "Different person" },
    })

    await expect(
      claimCreatedTargetCommand(harness.db, differentCommand),
    ).rejects.toMatchObject({
      name: ActionLedgerIdempotencyConflictError.name,
      existingActionId: first.claim.entry.id,
    })
  })

  it("rejects the same scope and key when the stable command identity changes", async () => {
    const harness = makeCreatedCommandDb()
    const baseInput = await makeInput()
    const first = await claimCreatedTargetCommand(harness.db, baseInput)
    const differentCommand = await makeInput({ commandTargetId: "command_2" })

    await expect(
      claimCreatedTargetCommand(harness.db, differentCommand),
    ).rejects.toMatchObject({
      name: ActionLedgerIdempotencyConflictError.name,
      existingActionId: first.claim.entry.id,
    })
  })

  it("fails replay distinctly when a committed claim has no result", async () => {
    const harness = makeCreatedCommandDb()
    const baseInput = await makeInput()
    const first = await claimCreatedTargetCommand(harness.db, baseInput)

    await expect(claimCreatedTargetCommand(harness.db, baseInput)).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandReplayIncompleteError.name,
      claimActionId: first.claim.entry.id,
    })
  })

  it.each([
    ["malformed_result_reference", "not-a-reference"],
    ["wrong_result_reference_type", "wrong-ref:person_1"],
    ["result_target_id_mismatch", "relationship-person-ref:person_2"],
  ] as const)("fails closed for %s", async (reason, commandResultRef) => {
    const harness = makeCreatedCommandDb()
    const baseInput = await makeInput()
    const first = await claimCreatedTargetCommand(harness.db, baseInput)
    const completed = await completeCreatedTargetCommand(harness.db, {
      claim: first.claim,
      targetId: "person_1",
    })
    const detail = harness.mutationDetails.find((row) => row.actionId === completed.entry.id)
    if (!detail) throw new Error("expected result mutation detail")
    detail.commandResultRef = commandResultRef

    await expect(claimCreatedTargetCommand(harness.db, baseInput)).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandReplayCorruptError.name,
      claimActionId: first.claim.entry.id,
      resultActionId: completed.entry.id,
      reason,
    })
  })

  it.each([
    ["result_target_type_mismatch", { targetType: "wrong-target" }],
    ["result_action_mismatch", { actionName: "wrong.action" }],
    ["result_fingerprint_mismatch", { idempotencyFingerprint: "sha256:corrupt" }],
  ] as const)("fails closed for corrupt result metadata: %s", async (reason, patch) => {
    const harness = makeCreatedCommandDb()
    const baseInput = await makeInput()
    const first = await claimCreatedTargetCommand(harness.db, baseInput)
    const completed = await completeCreatedTargetCommand(harness.db, {
      claim: first.claim,
      targetId: "person_1",
    })
    Object.assign(completed.entry, patch)

    await expect(claimCreatedTargetCommand(harness.db, baseInput)).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandReplayCorruptError.name,
      claimActionId: first.claim.entry.id,
      resultActionId: completed.entry.id,
      reason,
    })
  })

  it("rejects fingerprints that omit the created-target and policy metadata", async () => {
    const harness = makeCreatedCommandDb()
    const baseInput = await makeInput()

    await expect(
      claimCreatedTargetCommand(harness.db, {
        ...baseInput,
        idempotency: {
          ...baseInput.idempotency,
          fingerprint: "sha256:caller-supplied-without-required-metadata",
        },
      }),
    ).rejects.toMatchObject({
      name: ActionLedgerCreatedCommandFingerprintMismatchError.name,
      receivedFingerprint: "sha256:caller-supplied-without-required-metadata",
    })
    expect(harness.advisoryLocks).toEqual([])
  })

  it("requires a concrete principal before acquiring the claim lock", async () => {
    const harness = makeCreatedCommandDb()
    const baseInput = await makeInput()

    await expect(
      claimCreatedTargetCommand(harness.db, {
        ...baseInput,
        context: {},
      }),
    ).rejects.toThrow("requires a concrete request principal")
    expect(harness.advisoryLocks).toEqual([])
  })

  it("requires explicit policy inputs in the command fingerprint", async () => {
    await expect(
      buildCreatedTargetCommandFingerprint({
        actionName: "relationship.person.create",
        actionVersion: "v1",
        commandTarget: {
          type: "relationship-person-create-command",
          id: "command_1",
        },
        canonicalTargetType: "relationship-person",
        resultReferenceType: "relationship-person-ref",
        commandInput: { displayName: "Example person" },
        policyInputs: {},
      }),
    ).rejects.toThrow("policy inputs must be a non-empty object")
  })
})

async function makeInput(
  options: {
    commandTargetId?: string
    commandInput?: unknown
  } = {},
): Promise<ClaimCreatedTargetCommandInput> {
  const commandTarget = {
    type: "relationship-person-create-command",
    id: options.commandTargetId ?? "command_1",
  }
  const commandInput = options.commandInput ?? { displayName: "Example person" }
  const fingerprintInput = {
    commandInput,
    policyInputs: {
      approval: "required",
      capabilityId: "relationships:person:create",
      capabilityVersion: "v1",
      evaluatedRisk: "high",
    },
  }
  const fingerprint = await buildCreatedTargetCommandFingerprint({
    actionName: "relationship.person.create",
    actionVersion: "v1",
    commandTarget,
    canonicalTargetType: "relationship-person",
    resultReferenceType: "relationship-person-ref",
    ...fingerprintInput,
  })

  return {
    context: {
      userId: "usr_1",
      actor: "staff",
      organizationId: "org_1",
    },
    actionName: "relationship.person.create",
    actionVersion: "v1",
    evaluatedRisk: "high",
    commandTarget,
    canonicalTargetType: "relationship-person",
    resultReferenceType: "relationship-person-ref",
    routeOrToolName: "relationships.create_person",
    capabilityId: "relationships:person:create",
    capabilityVersion: "v1",
    authorizationSource: "relationships.create_person.handler",
    approvalId: "appr_1",
    causationActionId: "alge_approved_request",
    idempotency: {
      scope: "relationships.create_person:usr_1",
      key: "idem_1",
      fingerprint,
    },
    fingerprintInput,
    mutationDetail: {
      commandInputRef: "blob://commands/command_1",
      summary: "Create person command claimed",
    },
  }
}

function makeCreatedCommandDb() {
  const entries: ActionLedgerEntry[] = []
  const mutationDetails: ActionMutationDetail[] = []
  const events: string[] = []
  const advisoryLocks: unknown[] = []

  const db = {
    execute(query: unknown) {
      advisoryLocks.push(query)
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
                    const claim = entries.find((entry) =>
                      entry.idempotencyScope?.endsWith(":created-command-claim"),
                    )
                    return Promise.resolve(claim ? [{ claim }] : [])
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
            reversalCommandId: input.reversalCommandId ?? null,
            reversalCommandVersion: input.reversalCommandVersion ?? null,
            reversalArgsRef: input.reversalArgsRef ?? null,
            reversalStateProjection: input.reversalStateProjection ?? null,
            reversalOutcomeProjection: input.reversalOutcomeProjection ?? null,
            reversesActionId: input.reversesActionId ?? null,
            reversedByActionIdProjection: input.reversedByActionIdProjection ?? null,
          })
          mutationDetails.push(detail)
          events.push(`detail:${detail.actionId}`)
          return {}
        },
      }
    },
    transaction() {
      throw new Error("created-command helpers must use the supplied transaction handle directly")
    },
  } as unknown as AnyDrizzleDb

  return { db, entries, mutationDetails, events, advisoryLocks }
}

function claimScope(scope: string): string {
  return `${scope}:created-command-claim`
}

function resultScope(scope: string): string {
  return `${scope}:created-command-result`
}

import type { AnyDrizzleDb } from "@voyant-travel/db"
import { afterEach, describe, expect, it, vi } from "vitest"
import { runActionLedgerCanary } from "../../src/canary.js"
import { buildIdempotencyFingerprint } from "../../src/fingerprint.js"
import type { ActionLedgerEntry } from "../../src/schema.js"
import { actionLedgerService } from "../../src/service.js"

const baseDate = new Date("2026-05-17T10:00:00.000Z")
const db = {} as AnyDrizzleDb

function makeEntry(overrides: Partial<ActionLedgerEntry> = {}): ActionLedgerEntry {
  return {
    id: "alge_canary",
    occurredAt: baseDate,
    actionName: "action_ledger.canary.write",
    actionVersion: "v1",
    actionKind: "execute",
    status: "succeeded",
    evaluatedRisk: "low",
    actorType: "system",
    principalType: "system",
    principalId: "action-ledger-canary",
    principalSubtype: null,
    sessionId: null,
    apiTokenId: null,
    internalRequest: true,
    delegatedByPrincipalType: null,
    delegatedByPrincipalId: null,
    delegationId: null,
    callerType: "system",
    organizationId: null,
    routeOrToolName: "action-ledger.canary",
    workflowRunId: null,
    workflowStepId: null,
    correlationId: null,
    causationActionId: null,
    idempotencyScope: "action-ledger-canary",
    idempotencyKey: "canary-1",
    idempotencyFingerprint: "payload-1",
    targetType: "action_ledger_canary",
    targetId: "canary-1",
    capabilityId: "action-ledger.canary",
    capabilityVersion: "v1",
    authorizationSource: "action-ledger.canary",
    approvalId: null,
    amendsActionId: null,
    createdAt: baseDate,
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("runActionLedgerCanary", () => {
  it("writes a synthetic entry and confirms the entry is visible", async () => {
    const entry = makeEntry()
    const appendEntry = vi.spyOn(actionLedgerService, "appendEntry").mockResolvedValue({
      entry,
      replayed: false,
    })
    const listEntries = vi.spyOn(actionLedgerService, "listEntries").mockResolvedValue({
      entries: [entry],
      nextCursor: null,
    })
    await expect(
      runActionLedgerCanary(db, {
        idempotencyKey: "canary-1",
        now: baseDate,
      }),
    ).resolves.toEqual({
      ok: true,
      actionId: entry.id,
      replayed: false,
      observedWrite: true,
    })

    expect(appendEntry).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        actionName: "action_ledger.canary.write",
        targetType: "action_ledger_canary",
        targetId: "canary-1",
      }),
    )
    expect(listEntries).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        targetType: "action_ledger_canary",
        targetId: "canary-1",
      }),
    )
  })

  it("preserves the pre-upgrade fingerprint when replaying an explicit idempotency key", async () => {
    const legacyFingerprint = await buildIdempotencyFingerprint({
      actionName: "action_ledger.canary.write",
      actionVersion: "v1",
      targetType: "action_ledger_canary",
      targetId: "canary-1",
      commandInput: { payloadRef: "action-ledger-canary:canary-1" },
    })
    const entry = makeEntry({ idempotencyFingerprint: legacyFingerprint })
    const appendEntry = vi.spyOn(actionLedgerService, "appendEntry").mockResolvedValue({
      entry,
      replayed: true,
    })
    vi.spyOn(actionLedgerService, "listEntries").mockResolvedValue({
      entries: [entry],
      nextCursor: null,
    })

    await expect(
      runActionLedgerCanary(db, {
        idempotencyKey: "canary-1",
        now: baseDate,
      }),
    ).resolves.toMatchObject({ ok: true, replayed: true })
    expect(appendEntry).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ idempotencyFingerprint: legacyFingerprint }),
    )
  })

  it("reports failure when the entry is not visible", async () => {
    const entry = makeEntry()
    vi.spyOn(actionLedgerService, "appendEntry").mockResolvedValue({ entry, replayed: true })
    vi.spyOn(actionLedgerService, "listEntries").mockResolvedValue({
      entries: [],
      nextCursor: null,
    })

    await expect(
      runActionLedgerCanary(db, {
        idempotencyKey: "canary-1",
        now: baseDate,
      }),
    ).resolves.toEqual({
      ok: false,
      actionId: entry.id,
      replayed: true,
      observedWrite: false,
    })
  })
})

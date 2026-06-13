import { describe, expect, test } from "vitest"

import { actionLedgerService } from "../../src/service.js"
import {
  makeApproval,
  makeDelegation,
  makeEntry,
  makeMutationDetail,
  makePayload,
  makeRelayOutbox,
  makeSensitiveReadDetail,
} from "./service-fixtures.js"
import { makeRelayOutboxClaimDb, makeRelayOutboxUpdateDb } from "./service-list-fixtures.js"
import { makeGetApprovalDb, makeGetDelegationDb, makeGetEntryDb } from "./service-query-fixtures.js"

describe("actionLedgerService approval and delegation details", () => {
  test("returns an approval with its requested action details", async () => {
    const approval = makeApproval({
      id: "appr_detail",
      requestedActionId: "alge_requested",
    })
    const entry = makeEntry({
      id: approval.requestedActionId,
      status: "awaiting_approval",
      approvalId: approval.id,
    })
    const mutationDetail = makeMutationDetail({ actionId: entry.id })
    const sensitiveReadDetail = makeSensitiveReadDetail({ actionId: entry.id })
    const payload = makePayload({ actionId: entry.id })
    const relayOutbox = makeRelayOutbox({ actionId: entry.id })
    const { db, calls } = makeGetApprovalDb({
      approval,
      entry,
      mutationDetail,
      sensitiveReadDetail,
      payloads: [payload],
      relayOutbox: [relayOutbox],
    })

    await expect(actionLedgerService.getApproval(db, approval.id)).resolves.toEqual({
      approval,
      requestedAction: {
        entry,
        mutationDetail,
        sensitiveReadDetail,
        payloads: [payload],
        relayOutbox: [relayOutbox],
      },
    })
    expect(calls).toEqual([
      "action_approvals",
      "action_ledger_entries",
      "action_mutation_details",
      "action_sensitive_read_details",
      "action_ledger_payloads",
      "action_ledger_outbox",
    ])
  })

  test("returns null when an approval is missing", async () => {
    const { db, calls } = makeGetApprovalDb({})

    await expect(actionLedgerService.getApproval(db, "appr_missing")).resolves.toBeNull()
    expect(calls).toEqual(["action_approvals"])
  })

  test("returns one delegation", async () => {
    const delegation = makeDelegation({ id: "adel_detail" })
    const { db, calls } = makeGetDelegationDb(delegation)

    await expect(actionLedgerService.getDelegation(db, delegation.id)).resolves.toEqual({
      delegation,
    })
    expect(calls).toEqual(["action_delegations"])
  })

  test("returns null when a delegation is missing", async () => {
    const { db, calls } = makeGetDelegationDb(null)

    await expect(actionLedgerService.getDelegation(db, "adel_missing")).resolves.toBeNull()
    expect(calls).toEqual(["action_delegations"])
  })
})

describe("actionLedgerService relay outbox lifecycle", () => {
  test("claims due relay outbox rows and maps SQL result rows", async () => {
    const claimed = makeRelayOutbox({
      relayStatus: "processing",
      attemptCount: 1,
      nextRetryAt: new Date("2026-05-15T10:05:00.000Z"),
      lastError: null,
      processedAt: null,
    })
    const { db, queries } = makeRelayOutboxClaimDb([claimed])

    const result = await actionLedgerService.claimRelayOutbox(db, {
      organizationId: "org_1",
      dueAt: "2026-05-15T10:10:00.000Z",
      limit: 10,
    })

    expect(result.rows).toEqual([claimed])
    expect(queries).toHaveLength(1)
  })

  test("marks processing relay outbox rows as succeeded", async () => {
    const processedAt = new Date("2026-05-15T10:15:00.000Z")
    const row = makeRelayOutbox({
      relayStatus: "succeeded",
      nextRetryAt: null,
      lastError: null,
      processedAt,
    })
    const { db, patches } = makeRelayOutboxUpdateDb(row)

    await expect(
      actionLedgerService.markRelayOutboxSucceeded(db, {
        id: row.id,
        processedAt,
      }),
    ).resolves.toEqual(row)
    expect(patches).toEqual([
      {
        relayStatus: "succeeded",
        nextRetryAt: null,
        lastError: null,
        processedAt,
      },
    ])
  })

  test("marks processing relay outbox rows as retryable failures", async () => {
    const nextRetryAt = new Date("2026-05-15T10:20:00.000Z")
    const row = makeRelayOutbox({
      relayStatus: "failed",
      nextRetryAt,
      lastError: "Relay destination returned 503",
      processedAt: null,
    })
    const { db, patches } = makeRelayOutboxUpdateDb(row)

    await expect(
      actionLedgerService.markRelayOutboxFailed(db, {
        id: row.id,
        lastError: "Relay destination returned 503",
        nextRetryAt,
      }),
    ).resolves.toEqual(row)
    expect(patches).toEqual([
      {
        relayStatus: "failed",
        nextRetryAt,
        lastError: "Relay destination returned 503",
        processedAt: null,
      },
    ])
  })

  test("marks processing relay outbox rows as dead-lettered", async () => {
    const processedAt = new Date("2026-05-15T10:25:00.000Z")
    const row = makeRelayOutbox({
      relayStatus: "dead_letter",
      nextRetryAt: null,
      lastError: "Relay destination rejected payload",
      processedAt,
    })
    const { db, patches } = makeRelayOutboxUpdateDb(row)

    await expect(
      actionLedgerService.markRelayOutboxFailed(db, {
        id: row.id,
        lastError: "Relay destination rejected payload",
        deadLetter: true,
        processedAt,
      }),
    ).resolves.toEqual(row)
    expect(patches).toEqual([
      {
        relayStatus: "dead_letter",
        nextRetryAt: null,
        lastError: "Relay destination rejected payload",
        processedAt,
      },
    ])
  })
})

describe("actionLedgerService.getEntry", () => {
  test("returns an entry with mutation and sensitive-read details", async () => {
    const entry = makeEntry({
      id: "alge_detail",
      actionName: "booking.status.confirm",
      actionKind: "update",
      targetType: "booking",
      targetId: "book_1",
    })
    const mutationDetail = makeMutationDetail({ actionId: entry.id })
    const sensitiveReadDetail = makeSensitiveReadDetail({ actionId: entry.id })
    const payload = makePayload({ actionId: entry.id })
    const relayOutbox = makeRelayOutbox({ actionId: entry.id })
    const { db, calls } = makeGetEntryDb({
      entry,
      mutationDetail,
      sensitiveReadDetail,
      payloads: [payload],
      relayOutbox: [relayOutbox],
    })

    await expect(actionLedgerService.getEntry(db, entry.id)).resolves.toEqual({
      entry,
      mutationDetail,
      sensitiveReadDetail,
      payloads: [payload],
      relayOutbox: [relayOutbox],
    })
    expect(calls).toEqual([
      "action_ledger_entries",
      "action_mutation_details",
      "action_sensitive_read_details",
      "action_ledger_payloads",
      "action_ledger_outbox",
    ])
  })

  test("returns null when an entry is missing", async () => {
    const { db, calls } = makeGetEntryDb({})

    await expect(actionLedgerService.getEntry(db, "alge_missing")).resolves.toBeNull()
    expect(calls).toEqual(["action_ledger_entries"])
  })
})

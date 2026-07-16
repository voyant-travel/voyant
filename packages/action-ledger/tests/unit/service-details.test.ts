import { describe, expect, test } from "vitest"

import { actionLedgerService } from "../../src/service.js"
import {
  makeApproval,
  makeDelegation,
  makeEntry,
  makeMutationDetail,
  makePayload,
  makeSensitiveReadDetail,
} from "./service-fixtures.js"
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
    const { db, calls } = makeGetApprovalDb({
      approval,
      entry,
      mutationDetail,
      sensitiveReadDetail,
      payloads: [payload],
    })

    await expect(actionLedgerService.getApproval(db, approval.id)).resolves.toEqual({
      approval,
      requestedAction: {
        entry,
        mutationDetail,
        sensitiveReadDetail,
        payloads: [payload],
      },
    })
    expect(calls).toEqual([
      "action_approvals",
      "action_ledger_entries",
      "action_mutation_details",
      "action_sensitive_read_details",
      "action_ledger_payloads",
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
    const { db, calls } = makeGetEntryDb({
      entry,
      mutationDetail,
      sensitiveReadDetail,
      payloads: [payload],
    })

    await expect(actionLedgerService.getEntry(db, entry.id)).resolves.toEqual({
      entry,
      mutationDetail,
      sensitiveReadDetail,
      payloads: [payload],
    })
    expect(calls).toEqual([
      "action_ledger_entries",
      "action_mutation_details",
      "action_sensitive_read_details",
      "action_ledger_payloads",
    ])
  })

  test("returns null when an entry is missing", async () => {
    const { db, calls } = makeGetEntryDb({})

    await expect(actionLedgerService.getEntry(db, "alge_missing")).resolves.toBeNull()
    expect(calls).toEqual(["action_ledger_entries"])
  })
})

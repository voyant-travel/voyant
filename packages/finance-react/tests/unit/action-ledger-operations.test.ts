import { describe, expect, it } from "vitest"

import { listInvoiceActionLedger, listPaymentSessionActionLedger } from "../../src/operations.js"

const actionLedgerEntry = {
  id: "act_123",
  occurredAt: "2026-01-02T03:04:05.000Z",
  actionName: "finance.payment_session.complete",
  actionVersion: "1",
  actionKind: "update",
  status: "succeeded",
  evaluatedRisk: "low",
  actorType: "user",
  principalType: "user",
  principalId: "usr_123",
  principalSubtype: null,
  sessionId: "ses_123",
  apiTokenId: null,
  internalRequest: false,
  delegatedByPrincipalType: null,
  delegatedByPrincipalId: null,
  delegationId: null,
  callerType: "http",
  organizationId: "org_123",
  routeOrToolName: "finance.payment_session.complete",
  workflowRunId: null,
  workflowStepId: null,
  correlationId: "corr_123",
  causationActionId: null,
  idempotencyScope: "finance",
  idempotencyKey: "key_123",
  idempotencyFingerprint: "fp_123",
  targetType: "invoice",
  targetId: "inv_123",
  capabilityId: "finance.payment_session.complete",
  capabilityVersion: "1",
  authorizationSource: "capability",
  approvalId: null,
  amendsActionId: null,
  createdAt: "2026-01-02T03:04:06.000Z",
  mutationSummary: "Completed payment session",
}

function createFetcher(urls: string[]) {
  return async (url: string) => {
    urls.push(url)
    return new Response(
      JSON.stringify({
        data: [actionLedgerEntry],
        pageInfo: {
          nextCursor: {
            occurredAt: actionLedgerEntry.occurredAt,
            id: actionLedgerEntry.id,
          },
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}

describe("finance action ledger operations", () => {
  it("lists invoice action ledger entries with cursor pagination", async () => {
    const urls: string[] = []
    const result = await listInvoiceActionLedger(
      { baseUrl: "https://example.test", fetcher: createFetcher(urls) },
      "inv_123",
      {
        cursor: {
          occurredAt: "2026-01-01T00:00:00.000Z",
          id: "act_100",
        },
        limit: 25,
      },
    )

    expect(urls).toEqual([
      "https://example.test/v1/finance/invoices/inv_123/action-ledger?cursorOccurredAt=2026-01-01T00%3A00%3A00.000Z&cursorId=act_100&limit=25",
    ])
    expect(result.data).toHaveLength(1)
    expect(result.pageInfo.nextCursor).toEqual({
      occurredAt: actionLedgerEntry.occurredAt,
      id: actionLedgerEntry.id,
    })
  })

  it("lists payment session action ledger entries", async () => {
    const urls: string[] = []

    await listPaymentSessionActionLedger(
      { baseUrl: "https://example.test/", fetcher: createFetcher(urls) },
      "pay_ses_123",
    )

    expect(urls).toEqual([
      "https://example.test/v1/finance/payment-sessions/pay_ses_123/action-ledger",
    ])
  })
})

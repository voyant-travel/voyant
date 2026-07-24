import { actionLedgerService } from "@voyant-travel/action-ledger"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  authorizeFinanceRefund,
  resolveExecutedRefundCreditNoteId,
} from "../../src/refund-authorization.js"
import { financeService } from "../../src/service.js"

const db = {} as never

afterEach(() => {
  vi.restoreAllMocks()
})

describe("refund approval replay", () => {
  it("recovers the credit note result from an exactly validated prior execution", async () => {
    vi.spyOn(financeService, "getInvoiceById").mockResolvedValue({
      status: "issued",
      invoiceType: "invoice",
      invoiceNumber: "INV-1",
      currency: "EUR",
      totalCents: 1000,
      paidCents: 1000,
      balanceDueCents: 0,
      updatedAt: new Date("2026-07-15T10:00:00.000Z"),
    } as never)
    const validateApprovedAction = vi
      .spyOn(actionLedgerService, "validateApprovedAction")
      .mockImplementation(
        async (_db, validationInput) =>
          ({
            ok: false,
            reason: "already_executed",
            existingActionId: "action_execution_1",
            requestedAction: {
              idempotencyFingerprint: validationInput.idempotencyFingerprint,
              principalType: "agent",
              principalId: "agent_1",
              organizationId: "org_1",
            },
          }) as never,
      )
    vi.spyOn(actionLedgerService, "getEntry").mockResolvedValue({
      mutationDetail: { commandResultRef: "credit_note:credit_1" },
    } as never)

    await expect(
      authorizeFinanceRefund({
        db,
        invoiceId: "invoice_1",
        commandInput: {
          creditNoteNumber: "CN-1",
          status: "issued",
          amountCents: 1000,
          currency: "EUR",
          reason: "Approved refund",
        },
        actor: "staff",
        callerType: "agent",
        scopes: ["finance:refund"],
        requestContext: {
          agentId: "agent_1",
          organizationId: "org_1",
          callerType: "agent",
          actor: "staff",
        },
        approvalId: "approval_1",
        idempotencyKey: "refund-1",
      }),
    ).resolves.toMatchObject({ status: "already_executed", creditNoteId: "credit_1" })
    expect(validateApprovedAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizationId: "org_1" }),
    )
  })

  it("fails closed instead of recovering a previous result for a different fingerprint", async () => {
    vi.spyOn(financeService, "getInvoiceById").mockResolvedValue({
      status: "issued",
      invoiceType: "invoice",
      invoiceNumber: "INV-1",
      currency: "EUR",
      totalCents: 1000,
      paidCents: 1000,
      balanceDueCents: 0,
      updatedAt: new Date("2026-07-15T10:00:00.000Z"),
    } as never)
    vi.spyOn(actionLedgerService, "validateApprovedAction").mockResolvedValue({
      ok: false,
      reason: "already_executed",
      existingActionId: "action_execution_1",
      requestedAction: {
        idempotencyFingerprint: "sha256:different",
        principalType: "agent",
        principalId: "agent_1",
      },
    } as never)
    const getEntry = vi.spyOn(actionLedgerService, "getEntry")

    await expect(
      authorizeFinanceRefund({
        db,
        invoiceId: "invoice_1",
        commandInput: {
          creditNoteNumber: "CN-1",
          status: "issued",
          amountCents: 1000,
          currency: "EUR",
          reason: "Changed refund",
        },
        actor: "staff",
        callerType: "agent",
        scopes: ["finance:refund"],
        requestContext: { agentId: "agent_1", callerType: "agent", actor: "staff" },
        approvalId: "approval_1",
        idempotencyKey: "refund-1",
      }),
    ).resolves.toMatchObject({ status: "invalid_approval" })
    expect(getEntry).not.toHaveBeenCalled()
  })

  it.each([
    null,
    "invoice:invoice_1",
    "credit_note:   ",
  ])("fails closed when the previous execution result reference is %s", async (commandResultRef) => {
    vi.spyOn(actionLedgerService, "getEntry").mockResolvedValue(
      commandResultRef === null ? null : ({ mutationDetail: { commandResultRef } } as never),
    )

    await expect(resolveExecutedRefundCreditNoteId(db, "action_execution_1")).resolves.toBeNull()
  })
})

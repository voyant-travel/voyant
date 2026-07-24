import { actionLedgerService } from "@voyant-travel/action-ledger"
import { afterEach, describe, expect, it, vi } from "vitest"

import { authorizeFinanceInvoiceIssue } from "../../src/invoice-issue-authorization.js"

afterEach(() => vi.restoreAllMocks())

describe("invoice issue approval organization continuity", () => {
  it("passes the request organization into exact approval validation", async () => {
    const validateApprovedAction = vi
      .spyOn(actionLedgerService, "validateApprovedAction")
      .mockResolvedValue({ ok: false, reason: "organization_mismatch" })

    await expect(
      authorizeFinanceInvoiceIssue({
        db: {} as never,
        commandInput: { bookingId: "booking_1" } as never,
        actor: "staff",
        callerType: "agent",
        scopes: ["finance:write", "bookings:read"],
        requestContext: {
          agentId: "agent_1",
          organizationId: "org_1",
          callerType: "agent",
          actor: "staff",
        },
        approvalId: "approval_1",
      }),
    ).resolves.toMatchObject({
      status: "invalid_approval",
      validation: { reason: "organization_mismatch" },
    })
    expect(validateApprovedAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizationId: "org_1" }),
    )
  })
})

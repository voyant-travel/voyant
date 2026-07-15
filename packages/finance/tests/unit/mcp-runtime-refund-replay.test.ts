import type { ToolContext } from "@voyant-travel/tools"
import { afterEach, describe, expect, it, vi } from "vitest"

const authorizeFinanceRefund = vi.hoisted(() => vi.fn())

vi.mock("../../src/refund-authorization.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/refund-authorization.js")>()),
  authorizeFinanceRefund,
}))

import { voyantToolContextContribution } from "../../src/mcp-runtime.js"
import { financeService } from "../../src/service.js"
import type { FinanceToolServices } from "../../src/tools.js"

const db = {} as never
const toolContext: ToolContext = {
  db,
  actor: "staff",
  audience: "staff",
  tenantId: "operator_1",
  resolverScope: { locale: "en", audience: "staff", market: "default", actor: "staff" },
}
const request = {
  get(key: string) {
    return {
      actor: "staff",
      callerType: "agent",
      scopes: ["finance:refund"],
      agentId: "agent_1",
      isInternalRequest: false,
    }[key]
  },
  req: { header: () => null },
}
const input = {
  invoiceId: "invoice_1",
  creditNoteNumber: "CN-1",
  amountCents: 1000,
  currency: "EUR",
  reason: "Approved refund",
  idempotencyKey: "refund-1",
  approvalId: "approval_1",
}
const creditNote = {
  id: "credit_1",
  creditNoteNumber: "CN-1",
  invoiceId: "invoice_1",
  status: "issued",
  amountCents: 1000,
  currency: "EUR",
  baseCurrency: null,
  baseAmountCents: null,
  fxRateSetId: null,
  reason: "Approved refund",
  notes: null,
  createdAt: new Date("2026-07-15T10:00:00.000Z"),
  updatedAt: new Date("2026-07-15T10:00:00.000Z"),
}

afterEach(() => {
  vi.restoreAllMocks()
  authorizeFinanceRefund.mockReset()
})

async function financeTools() {
  const contribution = await voyantToolContextContribution.contribute({
    context: toolContext,
    request,
    resources: {},
  })
  return contribution.finance as FinanceToolServices
}

describe("issue_invoice_refund replay", () => {
  it("marks the first approved credit-note execution as non-replayed", async () => {
    authorizeFinanceRefund.mockResolvedValue({
      status: "authorized",
      access: { authorizationSource: "finance.refund.tool" },
      approvedAction: {
        requestedActionId: "action_requested_1",
        approvalId: "approval_1",
        idempotencyFingerprint: "sha256:approved",
      },
    })
    vi.spyOn(financeService, "createCreditNote").mockResolvedValue(creditNote as never)

    await expect((await financeTools()).issueInvoiceRefund(input)).resolves.toEqual({
      status: "issued",
      creditNote: {
        ...creditNote,
        createdAt: "2026-07-15T10:00:00.000Z",
        updatedAt: "2026-07-15T10:00:00.000Z",
      },
      replayed: false,
    })
  })

  it("returns the prior issued credit note and does not create another", async () => {
    authorizeFinanceRefund.mockResolvedValue({
      status: "already_executed",
      creditNoteId: "credit_1",
    })
    vi.spyOn(financeService, "getCreditNoteById").mockResolvedValue(creditNote as never)
    const create = vi.spyOn(financeService, "createCreditNote")

    await expect((await financeTools()).issueInvoiceRefund(input)).resolves.toEqual({
      status: "issued",
      creditNote: {
        ...creditNote,
        createdAt: "2026-07-15T10:00:00.000Z",
        updatedAt: "2026-07-15T10:00:00.000Z",
      },
      replayed: true,
    })
    expect(create).not.toHaveBeenCalled()
  })

  it("fails closed when the prior credit note cannot be loaded", async () => {
    authorizeFinanceRefund.mockResolvedValue({
      status: "already_executed",
      creditNoteId: "credit_missing",
    })
    vi.spyOn(financeService, "getCreditNoteById").mockResolvedValue(null)
    const create = vi.spyOn(financeService, "createCreditNote")

    await expect((await financeTools()).issueInvoiceRefund(input)).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
    expect(create).not.toHaveBeenCalled()
  })
})

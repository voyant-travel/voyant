import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import { type FinanceToolServices, financeTools } from "../src/tools.js"

function ctx(
  services?: Partial<FinanceToolServices>,
): ToolContext & { finance?: FinanceToolServices } {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "default",
    resolverScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
    finance: services as FinanceToolServices | undefined,
  }
}

describe("finance tools", () => {
  it("registers read tools and destructive finance actions", () => {
    const registry = createToolRegistry()
    registry.registerAll(financeTools)
    const list = registry.list()
    expect(list.map((t) => t.name).sort()).toEqual([
      "get_invoice",
      "issue_invoice_refund",
      "list_invoices",
      "void_invoice",
    ])
    const voidTool = list.find((t) => t.name === "void_invoice")
    expect(voidTool?.tier).toBe("destructive")
    expect(voidTool?.requiredScopes).toEqual(["finance:void"])
    expect(voidTool?.riskPolicy).toMatchObject({ destructive: true, confirmationRequired: true })
    const refundTool = list.find((t) => t.name === "issue_invoice_refund")
    expect(refundTool).toMatchObject({
      tier: "destructive",
      requiredScopes: ["finance:refund"],
      riskPolicy: { destructive: true, reversible: false, confirmationRequired: true },
    })
    for (const t of list.filter(
      (x) => !["void_invoice", "issue_invoice_refund"].includes(x.name),
    )) {
      expect(t.tier).toBe("read")
      expect(t.requiredScopes).toEqual(["finance:read"])
    }
  })

  it("dispatches reads + void through the injected service", async () => {
    const registry = createToolRegistry()
    registry.registerAll(financeTools)
    const invoice = {
      id: "inv_1",
      invoiceNumber: "INV-1",
      invoiceType: "invoice" as const,
      convertedFromInvoiceId: null,
      convertedToInvoiceId: null,
      convertedToInvoiceNumber: null,
      seriesId: null,
      sequence: null,
      templateId: null,
      taxRegimeId: null,
      language: "en",
      bookingId: "book_1",
      personId: null,
      organizationId: null,
      status: "issued" as const,
      currency: "EUR",
      baseCurrency: null,
      fxRateSetId: null,
      subtotalCents: 1000,
      baseSubtotalCents: null,
      taxCents: 0,
      baseTaxCents: null,
      totalCents: 1000,
      baseTotalCents: null,
      paidCents: 0,
      basePaidCents: null,
      balanceDueCents: 1000,
      baseBalanceDueCents: null,
      commissionPercent: null,
      commissionAmountCents: null,
      issueDate: "2026-07-15",
      dueDate: "2026-07-29",
      notes: null,
      voidedAt: null,
      voidReason: null,
      createdAt: "2026-07-15T10:00:00.000Z",
      updatedAt: "2026-07-15T10:00:00.000Z",
    }
    const services: FinanceToolServices = {
      async listInvoices() {
        return { data: [] }
      },
      async getInvoiceById(id) {
        return { ...invoice, id }
      },
      async getFinanceAggregates() {
        return { total: 0 }
      },
      async voidInvoice(id, input) {
        return {
          status: "voided",
          invoice: {
            ...invoice,
            id,
            status: "void",
            voidReason: input.reason ?? null,
            voidedAt: "2026-07-15T10:05:00.000Z",
          },
        }
      },
      async issueInvoiceRefund() {
        return {
          status: "approval_required",
          requestedAction: {
            id: "act_1",
            status: "awaiting_approval",
            actionName: "finance.credit_note.issue_refund",
            targetType: "invoice",
            targetId: "inv_1",
          },
          approval: {
            id: "apr_1",
            status: "pending",
            requestedActionId: "act_1",
            policyName: "finance-credit-note-refund-approval-v1",
            policyVersion: "v1",
            riskSnapshot: "critical",
            reasonCode: "invoice_credit_note_refund_requested_by_agent",
            expiresAt: null,
            createdAt: "2026-07-15T10:00:00.000Z",
          },
          replayed: false,
        }
      },
    }
    expect(await registry.dispatch("get_invoice", { id: "inv_1" }, ctx(services))).toMatchObject({
      id: "inv_1",
    })
    expect(
      await registry.dispatch("void_invoice", { id: "inv_2", reason: "dup" }, ctx(services)),
    ).toMatchObject({
      status: "voided",
      invoice: { id: "inv_2", status: "void", voidReason: "dup" },
    })
    expect(
      await registry.dispatch(
        "issue_invoice_refund",
        {
          invoiceId: "inv_1",
          creditNoteNumber: "CN-1",
          amountCents: 1000,
          currency: "EUR",
          reason: "operator adjustment",
          idempotencyKey: "refund-inv-1",
        },
        ctx(services),
      ),
    ).toMatchObject({ status: "approval_required", approval: { id: "apr_1" } })
  })

  it("throws MISSING_SERVICE when unwired", async () => {
    const registry = createToolRegistry()
    registry.registerAll(financeTools)
    await expect(registry.dispatch("list_invoices", {}, ctx(undefined))).rejects.toMatchObject({
      code: "MISSING_SERVICE",
    })
  })
})

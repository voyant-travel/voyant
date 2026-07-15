/**
 * Finance agent tools on the framework tool contract. Thin wrappers over the
 * existing finance service; the service is injected on the tool context
 * by intersection so this module stays deployment-agnostic.
 * Refunds are issued through the credit-note service after action approval.
 */
import { defineTool, READ_ONLY_RISK, requireService, type ToolContext } from "@voyant-travel/tools"
import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

import {
  creditNoteSchema,
  invoiceDetailSchema,
  invoiceListItemSchema,
  invoiceSchema,
} from "./routes-invoice-schemas.js"
import { insertCreditNoteSchema, invoiceListQuerySchema } from "./validation.js"

const voidInvoiceResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("not_found") }),
  z.object({ status: z.literal("already_void"), invoice: invoiceSchema }),
  z.object({ status: z.literal("draft"), invoice: invoiceSchema }),
  z.object({ status: z.literal("invalid_status"), invoice: invoiceSchema }),
  z.object({ status: z.literal("has_payments"), invoice: invoiceSchema }),
  z.object({ status: z.literal("has_credit_notes"), invoice: invoiceSchema }),
  z.object({ status: z.literal("voided"), invoice: invoiceSchema }),
])

export interface FinanceToolServices {
  listInvoices(query: z.infer<typeof invoiceListQuerySchema>): Promise<unknown>
  getInvoiceById(id: string): Promise<unknown>
  getFinanceAggregates(query: {
    range?: "this_month" | "last_month" | "year_to_date" | "all_time" | "custom"
    from?: string
    to?: string
    outstandingTopLimit?: number
  }): Promise<unknown>
  voidInvoice(id: string, input: { reason?: string }): Promise<unknown>
  issueInvoiceRefund(input: {
    invoiceId: string
    creditNoteNumber: string
    amountCents: number
    currency: string
    baseCurrency?: string | null
    baseAmountCents?: number | null
    fxRateSetId?: string | null
    reason: string
    notes?: string | null
    idempotencyKey: string
    approvalId?: string
  }): Promise<unknown>
}

export type FinanceToolContext = ToolContext & { finance?: FinanceToolServices }

function finance(ctx: FinanceToolContext): FinanceToolServices {
  return requireService(ctx.finance, "finance")
}

export const listInvoicesTool = defineTool<
  z.infer<typeof invoiceListQuerySchema>,
  unknown,
  FinanceToolContext
>({
  name: "list_invoices",
  description: "List invoices with filters and pagination. Read-only.",
  inputSchema: invoiceListQuerySchema,
  outputSchema: listResponseSchema(invoiceListItemSchema),
  requiredScopes: ["finance:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler(query, ctx) {
    return parseJsonResult(
      listResponseSchema(invoiceListItemSchema),
      await finance(ctx).listInvoices(query),
    )
  },
})

const getInvoiceArgs = z.object({ id: z.string().min(1).describe("The invoice id.") })

export const getInvoiceTool = defineTool<
  z.infer<typeof getInvoiceArgs>,
  unknown,
  FinanceToolContext
>({
  name: "get_invoice",
  description: "Read a single invoice by id. Read-only.",
  inputSchema: getInvoiceArgs,
  outputSchema: invoiceDetailSchema.nullable(),
  requiredScopes: ["finance:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler({ id }, ctx) {
    return parseJsonResult(invoiceDetailSchema.nullable(), await finance(ctx).getInvoiceById(id))
  },
})

const voidInvoiceArgs = z.object({
  id: z.string().min(1).describe("The invoice id to void."),
  reason: z.string().optional().describe("Optional reason recorded on the void."),
})

export const voidInvoiceTool = defineTool<
  z.infer<typeof voidInvoiceArgs>,
  unknown,
  FinanceToolContext
>({
  name: "void_invoice",
  description:
    "Void an invoice (irreversible). Returns a not-found status when the invoice does not exist.",
  inputSchema: voidInvoiceArgs,
  outputSchema: voidInvoiceResultSchema,
  requiredScopes: ["finance:void"],
  tier: "destructive",
  riskPolicy: {
    destructive: true,
    reversible: false,
    dryRunSupported: false,
    confirmationRequired: true,
  },
  async handler({ id, reason }, ctx) {
    return parseJsonResult(voidInvoiceResultSchema, await finance(ctx).voidInvoice(id, { reason }))
  },
})

export const issueInvoiceRefundInputSchema = insertCreditNoteSchema.omit({ status: true }).extend({
  invoiceId: z.string().min(1).describe("Invoice that receives the issued credit note."),
  idempotencyKey: z
    .string()
    .trim()
    .min(1)
    .describe("Stable key used when requesting approval and replaying the command."),
  approvalId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Approval id returned after the prior request is approved."),
})

const pendingInvoiceRefundSchema = z.object({
  status: z.literal("approval_required"),
  requestedAction: z.object({
    id: z.string(),
    status: z.string(),
    actionName: z.string(),
    targetType: z.string(),
    targetId: z.string(),
  }),
  approval: z.object({
    id: z.string(),
    status: z.string(),
    requestedActionId: z.string(),
    policyName: z.string(),
    policyVersion: z.string(),
    riskSnapshot: z.string(),
    reasonCode: z.string(),
    expiresAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  }),
  replayed: z.boolean(),
})

export const issueInvoiceRefundOutputSchema = z.union([
  pendingInvoiceRefundSchema,
  z.object({ status: z.literal("issued"), creditNote: creditNoteSchema }),
])

export const issueInvoiceRefundTool = defineTool<
  z.infer<typeof issueInvoiceRefundInputSchema>,
  z.infer<typeof issueInvoiceRefundOutputSchema>,
  FinanceToolContext
>({
  owner: "@voyant-travel/finance",
  capabilityId: "@voyant-travel/finance#tool.issue-invoice-refund",
  capabilityVersion: "v1",
  name: "issue_invoice_refund",
  description:
    "Request approval to refund an invoice by issuing a credit note, or execute the exact approved request.",
  inputSchema: issueInvoiceRefundInputSchema,
  outputSchema: issueInvoiceRefundOutputSchema,
  requiredScopes: ["finance:refund"],
  audience: { source: "grant", allowed: ["staff"] },
  tier: "destructive",
  riskPolicy: {
    destructive: true,
    reversible: false,
    dryRunSupported: false,
    confirmationRequired: true,
    sideEffects: ["refund", "data-write"],
  },
  annotations: { idempotentHint: true },
  actionPolicyEnforcement: "handler",
  async handler(input, ctx) {
    return issueInvoiceRefundOutputSchema.parse(await finance(ctx).issueInvoiceRefund(input))
  },
})

export const financeTools = [
  listInvoicesTool,
  getInvoiceTool,
  voidInvoiceTool,
  issueInvoiceRefundTool,
] as const

function parseJsonResult<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  return schema.parse(toJsonValue(value))
}

function toJsonValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toJsonValue)
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, nested]) => [key, toJsonValue(nested)] as const)
      .filter(([, nested]) => nested !== undefined),
  )
}

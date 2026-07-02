/**
 * Finance agent tools on the framework tool contract. Thin, read-only wrappers
 * over the existing finance service; the service is injected on the tool context
 * by intersection so this module stays deployment-agnostic.
 */
import { defineTool, READ_ONLY_RISK, requireService, type ToolContext } from "@voyant-travel/tools"
import { z } from "zod"

import { invoiceListQuerySchema } from "./validation.js"

export interface FinanceToolServices {
  listInvoices(query: z.infer<typeof invoiceListQuerySchema>): Promise<unknown>
  getInvoiceById(id: string): Promise<unknown>
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
  outputSchema: z.custom<unknown>(),
  requiredScopes: ["finance:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler(query, ctx) {
    return finance(ctx).listInvoices(query)
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
  outputSchema: z.custom<unknown>(),
  requiredScopes: ["finance:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler({ id }, ctx) {
    return finance(ctx).getInvoiceById(id)
  },
})

export const financeTools = [listInvoicesTool, getInvoiceTool] as const

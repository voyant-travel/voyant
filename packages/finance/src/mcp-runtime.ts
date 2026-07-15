import { defineToolContextContribution } from "@voyant-travel/tools"
import { financeService } from "./service.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["finance"],
  contribute: ({ context }) => {
    const db = context.db as Parameters<typeof financeService.listInvoices>[0]
    return {
      finance: {
        listInvoices: (query: Parameters<typeof financeService.listInvoices>[1]) =>
          financeService.listInvoices(db, query),
        getInvoiceById: (id: string) => financeService.getInvoiceById(db, id),
        getFinanceAggregates: (query: Parameters<typeof financeService.getFinanceAggregates>[1]) =>
          financeService.getFinanceAggregates(db, query),
        voidInvoice: (id: string, input: { reason?: string }) =>
          financeService.voidInvoice(db, id, input),
      },
    }
  },
})

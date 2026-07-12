import { defineToolContextContribution } from "@voyant-travel/tools"
import { quotesService } from "./service/index.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["quotes"],
  contribute: ({ context }) => {
    const db = context.db as Parameters<typeof quotesService.listQuotes>[0]
    return {
      quotes: {
        listQuotes: (query: Parameters<typeof quotesService.listQuotes>[1]) =>
          quotesService.listQuotes(db, query),
        getQuoteById: (id: string) => quotesService.getQuoteById(db, id),
        acceptQuoteVersion: (id: string) => quotesService.acceptQuoteVersion(db, id),
      },
    }
  },
})

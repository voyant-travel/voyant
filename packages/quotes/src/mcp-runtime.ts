import { defineToolContextContribution, requireService, ToolError } from "@voyant-travel/tools"
import type { Context } from "hono"
import {
  type QuotesNotificationsRuntime,
  type QuotesProposalRuntime,
  quotesNotificationsRuntimePort,
  quotesProposalRuntimePort,
} from "./runtime-port.js"
import { quotesService } from "./service/index.js"
import {
  QuoteDeliveryFailedError,
  QuoteDeliveryIdempotencyConflictError,
  snapshotAndSendQuote,
} from "./service/quote-delivery.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["quotes", "quoteDelivery"],
  contribute: ({ context, request, resources }) => {
    const db = context.db as Parameters<typeof quotesService.listQuotes>[0]
    const c = request as Context
    return {
      quotes: {
        listQuotes: (query: Parameters<typeof quotesService.listQuotes>[1]) =>
          quotesService.listQuotes(db, query),
        getQuoteById: (id: string) => quotesService.getQuoteById(db, id),
        snapshotQuoteVersion: (quoteId: string) =>
          quotesService.createVersionSnapshotFromQuote(db, quoteId),
        sendQuoteVersion: (
          id: string,
          input: Parameters<typeof quotesService.sendQuoteVersion>[2],
        ) => quotesService.sendQuoteVersion(db, id, input),
        acceptQuoteVersion: (id: string) => quotesService.acceptQuoteVersion(db, id),
        declineQuoteVersion: (id: string) => quotesService.declineQuoteVersion(db, id),
      },
      quoteDelivery: {
        async snapshotAndSendQuote(input: Parameters<typeof snapshotAndSendQuote>[2]) {
          const notifications = await Promise.resolve(
            requireService(
              resources[quotesNotificationsRuntimePort.id] as
                | QuotesNotificationsRuntime
                | Promise<QuotesNotificationsRuntime>
                | undefined,
              quotesNotificationsRuntimePort.id,
            ),
          )
          const proposal = await Promise.resolve(
            requireService(
              resources[quotesProposalRuntimePort.id] as
                | QuotesProposalRuntime
                | Promise<QuotesProposalRuntime>
                | undefined,
              quotesProposalRuntimePort.id,
            ),
          )
          try {
            const result = await snapshotAndSendQuote(db, notifications, input, {
              publicProposalBaseUrl: proposal.resolvePublicProposalBaseUrl(c),
              bindings: c.env as Record<string, unknown>,
            })
            if (!result) throw new ToolError("Quote not found.", "NOT_FOUND")
            return result
          } catch (error) {
            if (error instanceof QuoteDeliveryIdempotencyConflictError) {
              throw new ToolError(error.message, "INVALID_INPUT")
            }
            if (error instanceof QuoteDeliveryFailedError) {
              throw new ToolError(error.message, "PROVIDER_ERROR")
            }
            throw error
          }
        },
      },
    }
  },
})

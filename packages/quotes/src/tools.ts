/**
 * Quotes agent tools on the framework tool contract. Thin, read-only wrappers
 * over the existing quotes service; the service is injected on the tool context
 * by intersection so this module stays deployment-agnostic.
 */
import { defineTool, READ_ONLY_RISK, requireService, type ToolContext } from "@voyant-travel/tools"
import { z } from "zod"

import { quoteListQuerySchema } from "./validation.js"

export interface QuotesToolServices {
  listQuotes(query: z.infer<typeof quoteListQuerySchema>): Promise<unknown>
  getQuoteById(id: string): Promise<unknown>
}

export type QuotesToolContext = ToolContext & { quotes?: QuotesToolServices }

function quotes(ctx: QuotesToolContext): QuotesToolServices {
  return requireService(ctx.quotes, "quotes")
}

export const listQuotesTool = defineTool<
  z.infer<typeof quoteListQuerySchema>,
  unknown,
  QuotesToolContext
>({
  name: "list_quotes",
  description: "List quotes with filters and pagination. Read-only.",
  inputSchema: quoteListQuerySchema,
  outputSchema: z.custom<unknown>(),
  requiredScopes: ["quotes:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler(query, ctx) {
    return quotes(ctx).listQuotes(query)
  },
})

const getQuoteArgs = z.object({ id: z.string().min(1).describe("The quote id.") })

export const getQuoteTool = defineTool<z.infer<typeof getQuoteArgs>, unknown, QuotesToolContext>({
  name: "get_quote",
  description: "Read a single quote (with its versions) by id. Read-only.",
  inputSchema: getQuoteArgs,
  outputSchema: z.custom<unknown>(),
  requiredScopes: ["quotes:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler({ id }, ctx) {
    return quotes(ctx).getQuoteById(id)
  },
})

export const quotesTools = [listQuotesTool, getQuoteTool] as const

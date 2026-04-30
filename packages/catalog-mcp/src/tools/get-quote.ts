/**
 * `get_quote` tool — calls the source adapter to lock a priced quote.
 * Live-pricing path; never cached, never embedded.
 *
 * The returned `quoteId` can be passed to a downstream booking flow. The
 * `expiresAt` field tells agents when to warn users that the price may
 * change.
 */

import { z } from "zod"

import type { McpToolDefinition, McpToolResult } from "../contract.js"
import { requireService } from "../registry.js"

const getQuoteArgs = z.object({
  vertical: z.string().describe("The catalog vertical."),
  entityId: z.string().describe("Entity id."),
  parameters: z
    .record(z.string(), z.unknown())
    .default({})
    .describe("Vertical-specific quote parameters: dates, pax, currency, fare class, etc."),
})

export type GetQuoteArgs = z.infer<typeof getQuoteArgs>

export const getQuoteTool: McpToolDefinition<GetQuoteArgs, McpToolResult> = {
  name: "get_quote",
  description:
    "Lock a live priced quote for a catalog entry. Returns a quoteId that can be passed to a " +
    "booking flow plus the locked total price and an optional expiry timestamp. " +
    "Always live; never cached at the catalog plane.",
  inputSchema: getQuoteArgs,
  async handler(args, context) {
    const getQuote = requireService(context.catalog.getQuote, "getQuote")
    const result = await getQuote(args.vertical, args.entityId, args.parameters)

    const expiry = result.expiresAt ? ` (expires ${result.expiresAt})` : ""
    const summary = `Quote ${result.quoteId} for ${args.vertical}/${args.entityId}: ${result.totalPrice.amount} ${result.totalPrice.currency}${expiry}.`

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        vertical: args.vertical,
        entityId: args.entityId,
        quoteId: result.quoteId,
        totalPrice: result.totalPrice,
        expiresAt: result.expiresAt,
        breakdown: result.breakdown,
      },
    }
  },
}

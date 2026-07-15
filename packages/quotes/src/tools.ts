/**
 * Quotes agent tools on the framework tool contract. Thin, read-only wrappers
 * over the existing quotes service; the service is injected on the tool context
 * by intersection so this module stays deployment-agnostic.
 */
import { defineTool, READ_ONLY_RISK, requireService, type ToolContext } from "@voyant-travel/tools"
import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

import { acceptQuoteVersionResultSchema, quoteSchema } from "./routes/openapi-schemas.js"
import { quoteListQuerySchema } from "./validation.js"

export interface QuotesToolServices {
  listQuotes(query: z.infer<typeof quoteListQuerySchema>): Promise<unknown>
  getQuoteById(id: string): Promise<unknown>
  acceptQuoteVersion(quoteVersionId: string): Promise<unknown>
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
  outputSchema: listResponseSchema(quoteSchema),
  requiredScopes: ["quotes:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler(query, ctx) {
    return parseJsonResult(listResponseSchema(quoteSchema), await quotes(ctx).listQuotes(query))
  },
})

const getQuoteArgs = z.object({ id: z.string().min(1).describe("The quote id.") })

export const getQuoteTool = defineTool<z.infer<typeof getQuoteArgs>, unknown, QuotesToolContext>({
  name: "get_quote",
  description: "Read a single quote (with its versions) by id. Read-only.",
  inputSchema: getQuoteArgs,
  outputSchema: quoteSchema.nullable(),
  requiredScopes: ["quotes:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler({ id }, ctx) {
    return parseJsonResult(quoteSchema.nullable(), await quotes(ctx).getQuoteById(id))
  },
})

const acceptQuoteVersionArgs = z.object({
  quoteVersionId: z.string().min(1).describe("The quote version id to accept."),
})

export const acceptQuoteVersionTool = defineTool<
  z.infer<typeof acceptQuoteVersionArgs>,
  unknown,
  QuotesToolContext
>({
  name: "accept_quote_version",
  description:
    "Accept a sent quote version, moving the quote toward commitment. Returns null when the " +
    "version is not found.",
  inputSchema: acceptQuoteVersionArgs,
  outputSchema: acceptQuoteVersionResultSchema.nullable(),
  requiredScopes: ["quotes:write"],
  tier: "write",
  riskPolicy: {
    destructive: false,
    reversible: false,
    dryRunSupported: false,
    confirmationRequired: true,
  },
  async handler({ quoteVersionId }, ctx) {
    return parseJsonResult(
      acceptQuoteVersionResultSchema.nullable(),
      await quotes(ctx).acceptQuoteVersion(quoteVersionId),
    )
  },
})

export const quotesTools = [listQuotesTool, getQuoteTool, acceptQuoteVersionTool] as const

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

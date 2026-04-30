/**
 * `suggest_alternatives` tool — semantic similarity for "more like this".
 * Fetches the seed entity, then runs a semantic search using a synthesized
 * query built from the entity's title + description.
 *
 * Useful for AI agents asked "show me products like X" — the agent calls
 * this rather than crafting its own search query.
 */

import { executeSemanticSearch } from "@voyantjs/voyant-catalog-rag"
import { z } from "zod"

import type { McpToolDefinition, McpToolResult } from "../contract.js"
import { enforceAudienceAuthorization, requireService } from "../registry.js"

const suggestAlternativesArgs = z.object({
  vertical: z.string().describe("The catalog vertical to search."),
  seedEntityId: z.string().describe("Id of the entity to find alternatives for."),
  limit: z.number().int().positive().max(50).default(10).describe("Max alternatives to return."),
})

export type SuggestAlternativesArgs = z.infer<typeof suggestAlternativesArgs>

export const suggestAlternativesTool: McpToolDefinition<SuggestAlternativesArgs, McpToolResult> = {
  name: "suggest_alternatives",
  description:
    "Find catalog entries semantically similar to a seed entity. The seed's title + description " +
    "are vectorized and matched against the audience's embedding pool. The seed itself is excluded from results.",
  inputSchema: suggestAlternativesArgs,
  async handler(args, context) {
    const indexer = requireService(context.catalog.indexer, "indexer")
    const embeddings = requireService(context.catalog.embeddings, "embeddings")
    const resolveEntity = requireService(context.catalog.resolveEntity, "resolveEntity")

    const seed = await resolveEntity(args.vertical, args.seedEntityId, context.defaultScope)
    if (!seed) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `[NOT_FOUND] No ${args.vertical} entity with id "${args.seedEntityId}".`,
          },
        ],
        structuredContent: {
          error: {
            code: "NOT_FOUND",
            vertical: args.vertical,
            entityId: args.seedEntityId,
          },
        },
      }
    }

    const titlePart =
      (seed.fields.title as string | undefined) ?? (seed.fields.name as string | undefined) ?? ""
    const descPart =
      (seed.fields.description as string | undefined) ??
      (seed.fields.shortDescription as string | undefined) ??
      ""
    const query = `${titlePart}\n${descPart}`.trim()

    const slice = (
      context.catalog.defaultSliceFor ??
      ((vertical) => ({
        vertical,
        locale: context.defaultScope.locale,
        audience: context.defaultScope.audience,
        market: context.defaultScope.market,
      }))
    )(args.vertical, context.defaultScope)

    enforceAudienceAuthorization(context.actor, [slice.audience])

    const results = await executeSemanticSearch({
      adapter: indexer,
      embeddings,
      slice,
      request: {
        query,
        mode: "semantic",
        pagination: { limit: args.limit + 1 },
      },
    })

    // Drop the seed itself if it surfaces in results.
    const filtered = results.hits.filter((hit) => hit.id !== args.seedEntityId).slice(0, args.limit)
    const summary = `Found ${filtered.length} alternative(s) similar to ${titlePart || args.seedEntityId}.`
    const lines = filtered.map((hit, i) => {
      const t =
        (hit.document.fields.title as string | undefined) ??
        (hit.document.fields.name as string | undefined) ??
        hit.id
      return `${i + 1}. ${t} (id: ${hit.id}, similarity: ${hit.score.toFixed(2)})`
    })

    return {
      content: [{ type: "text", text: [summary, ...lines].join("\n") }],
      structuredContent: {
        vertical: args.vertical,
        seedEntityId: args.seedEntityId,
        alternatives: filtered.map((hit) => ({
          id: hit.id,
          score: hit.score,
          fields: hit.document.fields,
        })),
      },
    }
  },
}

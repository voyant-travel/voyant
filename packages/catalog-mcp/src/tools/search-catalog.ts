/**
 * `search_catalog` tool — keyword / hybrid / semantic search across a
 * vertical. Wraps `executeSemanticSearch` from `@voyantjs/catalog-rag`.
 *
 * Visibility filtering and audience-pool enforcement happen at the
 * underlying API layer; the tool just wires args through.
 */

import { executeSemanticSearch } from "@voyantjs/catalog-rag"
import { z } from "zod"

import type { McpToolDefinition, McpToolResult } from "../contract.js"
import { enforceAudienceAuthorization, requireService } from "../registry.js"

const searchCatalogArgs = z.object({
  vertical: z.string().describe('The catalog vertical to search (e.g. "products", "cruises").'),
  query: z.string().describe("Free-text query."),
  mode: z
    .enum(["keyword", "hybrid", "semantic"])
    .default("hybrid")
    .describe("Search mode. Hybrid blends keyword + vector; semantic is pure vector."),
  limit: z.number().int().positive().max(100).default(20).describe("Max results."),
  filters: z
    .array(
      z.object({
        field: z.string(),
        op: z.enum(["eq", "in", "range"]),
        value: z.unknown(),
      }),
    )
    .optional()
    .describe("Optional filter expressions (engine-translated)."),
})

export type SearchCatalogArgs = z.infer<typeof searchCatalogArgs>

export const searchCatalogTool: McpToolDefinition<SearchCatalogArgs, McpToolResult> = {
  name: "search_catalog",
  description:
    "Search a catalog vertical for sellable inventory matching a free-text query. " +
    "Supports keyword, hybrid (keyword + semantic), or pure semantic search modes. " +
    "Results are visibility-filtered for the calling actor; non-staff actors only see their own audience's view.",
  inputSchema: searchCatalogArgs,
  async handler(args, context) {
    const indexer = requireService(context.catalog.indexer, "indexer")
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

    const results =
      args.mode === "keyword"
        ? await indexer.search(slice, {
            query: args.query,
            mode: "keyword",
            pagination: { limit: args.limit },
            filters: args.filters?.map(toSearchFilter),
          })
        : await executeSemanticSearch({
            adapter: indexer,
            embeddings: requireService(context.catalog.embeddings, "embeddings"),
            slice,
            request: {
              query: args.query,
              mode: args.mode,
              pagination: { limit: args.limit },
              filters: args.filters?.map(toSearchFilter),
            },
          })

    const summary = `Found ${results.hits.length} result(s) in ${args.vertical}.`
    const lines = results.hits.slice(0, args.limit).map((hit, i) => {
      const title =
        (hit.document.fields.title as string | undefined) ??
        (hit.document.fields.name as string | undefined) ??
        hit.id
      return `${i + 1}. ${title} (id: ${hit.id}, score: ${hit.score.toFixed(2)})`
    })

    return {
      content: [{ type: "text", text: [summary, ...lines].join("\n") }],
      structuredContent: {
        vertical: args.vertical,
        total: results.total,
        hits: results.hits.slice(0, args.limit).map((hit) => ({
          id: hit.id,
          score: hit.score,
          fields: hit.document.fields,
        })),
      },
    }
  },
}

function toSearchFilter(
  filter: SearchCatalogArgs["filters"] extends (infer T)[] | undefined ? T : never,
) {
  switch (filter.op) {
    case "eq":
      return {
        kind: "eq" as const,
        field: filter.field,
        value: filter.value as string | number | boolean,
      }
    case "in":
      return {
        kind: "in" as const,
        field: filter.field,
        values: filter.value as ReadonlyArray<string | number>,
      }
    case "range": {
      const range = filter.value as { gte?: number; lte?: number }
      return {
        kind: "range" as const,
        field: filter.field,
        gte: range.gte,
        lte: range.lte,
      }
    }
  }
}

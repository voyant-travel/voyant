/**
 * `get_entity` tool — fetch a single resolved CatalogEntry view by id.
 * Wraps the per-vertical `resolveEntity` helper injected via context.
 */

import { z } from "zod"

import type { McpToolDefinition, McpToolResult } from "../contract.js"
import { requireService } from "../registry.js"

const getEntityArgs = z.object({
  vertical: z
    .string()
    .describe('The catalog vertical (e.g. "products", "cruises", "hospitality").'),
  entityId: z.string().describe("Entity id."),
})

export type GetEntityArgs = z.infer<typeof getEntityArgs>

export const getEntityTool: McpToolDefinition<GetEntityArgs, McpToolResult> = {
  name: "get_entity",
  description:
    "Fetch a single resolved CatalogEntry by vertical + id. Returns the visibility-filtered view " +
    "for the calling actor (overlays applied, internal-only fields hidden when applicable).",
  inputSchema: getEntityArgs,
  async handler(args, context) {
    const resolveEntity = requireService(context.catalog.resolveEntity, "resolveEntity")
    const view = await resolveEntity(args.vertical, args.entityId, context.defaultScope)
    if (!view) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `[NOT_FOUND] No ${args.vertical} entity with id "${args.entityId}".`,
          },
        ],
        structuredContent: {
          error: { code: "NOT_FOUND", vertical: args.vertical, entityId: args.entityId },
        },
      }
    }

    const title =
      (view.fields.title as string | undefined) ??
      (view.fields.name as string | undefined) ??
      view.entityId
    const description =
      (view.fields.description as string | undefined) ??
      (view.fields.shortDescription as string | undefined) ??
      ""

    return {
      content: [
        {
          type: "text",
          text: [
            `# ${title}`,
            description ? `\n${description}` : "",
            `\n_id: ${view.entityId} • vertical: ${view.vertical}_`,
          ].join("\n"),
        },
      ],
      structuredContent: {
        vertical: view.vertical,
        entityId: view.entityId,
        fields: view.fields,
        provenance: view.provenance,
      },
    }
  },
}

/**
 * `check_availability` tool — calls the source adapter's volatile-live
 * availability path. Per architecture, volatile-live values are always
 * fetched live, never indexed, never embedded.
 */

import { z } from "zod"

import type { McpToolDefinition, McpToolResult } from "../contract.js"
import { requireService } from "../registry.js"

const checkAvailabilityArgs = z.object({
  vertical: z.string().describe("The catalog vertical."),
  entityId: z.string().describe("Entity id."),
  parameters: z
    .record(z.string(), z.unknown())
    .default({})
    .describe(
      "Vertical-specific parameters: dates, occupancy, currency, market — whatever the live-availability call needs.",
    ),
})

export type CheckAvailabilityArgs = z.infer<typeof checkAvailabilityArgs>

export const checkAvailabilityTool: McpToolDefinition<CheckAvailabilityArgs, McpToolResult> = {
  name: "check_availability",
  description:
    "Check live availability for a catalog entry. Routes through the configured source adapter — " +
    "values are always fresh, never cached at the catalog plane. Use this before suggesting a quote.",
  inputSchema: checkAvailabilityArgs,
  async handler(args, context) {
    const checkAvailability = requireService(context.catalog.checkAvailability, "checkAvailability")
    const result = await checkAvailability(args.vertical, args.entityId, args.parameters)

    const summary = result.available
      ? `${args.vertical}/${args.entityId} is AVAILABLE (checked at ${result.checkedAt}).`
      : `${args.vertical}/${args.entityId} is NOT AVAILABLE (checked at ${result.checkedAt}).`

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        vertical: args.vertical,
        entityId: args.entityId,
        available: result.available,
        checkedAt: result.checkedAt,
        details: result.details,
      },
    }
  },
}

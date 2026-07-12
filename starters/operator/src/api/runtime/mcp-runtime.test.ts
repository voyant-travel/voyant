import { createVoyantGraphRuntime } from "@voyant-travel/framework/deployment-artifacts"
import {
  defineTool,
  defineToolContextContribution,
  READ_ONLY_RISK,
} from "@voyant-travel/tools"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { buildMcpAdminRoutes } from "./mcp-runtime"

const listLoyaltyTool = defineTool({
  name: "list_loyalty_members",
  description: "List loyalty members",
  inputSchema: z.object({}),
  outputSchema: z.object({ members: z.array(z.string()) }),
  requiredScopes: ["loyalty:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  handler: async () => ({ members: [] }),
})

const voyantToolContextContribution = defineToolContextContribution({
  context: ["loyalty"],
  contribute: () => ({ loyalty: { list: () => [] } }),
})

function selectedRuntime(
  load = vi.fn(async () => ({ listLoyaltyTool, voyantToolContextContribution })),
) {
  return {
    load,
    runtime: createVoyantGraphRuntime({
      graphHash: "sha256:selected",
      entries: { "@acme/loyalty/tools": load },
      modules: [
        {
          id: "@acme/loyalty",
          kind: "module" as const,
          packageName: "@acme/loyalty",
          order: 0,
          accessScopes: ["loyalty:read"],
          references: [
            {
              id: "loyalty-tool-runtime",
              unitId: "@acme/loyalty",
              facet: "tools.runtime" as const,
              entityId: "loyalty-tool",
              runtime: { entry: "./tools", export: "listLoyaltyTool" },
              importEntry: "@acme/loyalty/tools",
            },
          ],
          tools: [
            {
              id: "loyalty-tool",
              unitId: "@acme/loyalty",
              name: "list_loyalty_members",
              referenceId: "loyalty-tool-runtime",
              requiredScopes: ["loyalty:read"],
              context: ["loyalty"],
            },
          ],
          routes: [],
        },
      ],
      plugins: [],
    }),
  }
}

describe("operator MCP graph composition", () => {
  it("registers only tools selected by the generated graph", async () => {
    const selected = selectedRuntime()
    expect(selected.load).not.toHaveBeenCalled()

    const selectedApp = await buildMcpAdminRoutes(selected.runtime)
    const authorized = new Hono<{ Variables: { scopes: string[] } }>()
    authorized.use("*", async (c, next) => {
      c.set("scopes", ["loyalty:read"])
      await next()
    })
    authorized.route("/", selectedApp)
    const selectedManifest = (await (await authorized.request("/manifest")).json()) as {
      tools: Array<{ name: string; requiredScopes: string[] }>
    }

    expect(selectedManifest.tools).toEqual([
      expect.objectContaining({
        name: "list_loyalty_members",
        requiredScopes: ["loyalty:read"],
      }),
    ])
    expect(selected.load).toHaveBeenCalledTimes(1)

    const emptyApp = await buildMcpAdminRoutes(
      createVoyantGraphRuntime({
        graphHash: "sha256:empty",
        entries: {},
        modules: [],
        plugins: [],
      }),
    )
    const emptyManifest = (await (await emptyApp.request("/manifest")).json()) as {
      tools: unknown[]
    }
    expect(emptyManifest.tools).toEqual([])
  })
})

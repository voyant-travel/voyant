import { createToolRegistry } from "@voyant-travel/tools"
import { describe, expect, it, vi } from "vitest"
import {
  createVoyantGraphRuntime,
  registerVoyantGraphTools,
  VoyantGraphRuntimeLoadError,
} from "./runtime-lowering.js"

function runtimeInput(load: () => Promise<unknown>) {
  return {
    graphHash: "sha256:test",
    entries: {
      "@acme/voyant-loyalty/runtime": load,
    },
    modules: [
      {
        id: "@acme/voyant-loyalty",
        kind: "module" as const,
        packageName: "@acme/voyant-loyalty",
        order: 0,
        routes: [
          {
            route: {
              id: "@acme/voyant-loyalty#api.admin",
              surface: "admin" as const,
              runtime: {
                entry: "./runtime",
                export: "createLoyaltyModule",
              },
            },
            importEntry: "@acme/voyant-loyalty/runtime",
          },
          {
            route: {
              id: "@acme/voyant-loyalty#api.public",
              surface: "public" as const,
              runtime: {
                entry: "./runtime",
                export: "createLoyaltyModule",
              },
            },
            importEntry: "@acme/voyant-loyalty/runtime",
          },
        ],
      },
    ],
    plugins: [],
  }
}

describe("graph runtime lowering", () => {
  it("keeps package imports lazy and memoized across route and unit loaders", async () => {
    const factory = () => ({ module: { name: "loyalty" } })
    const importRuntime = vi.fn(async () => ({ createLoyaltyModule: factory }))
    const runtime = createVoyantGraphRuntime(runtimeInput(importRuntime))

    expect(importRuntime).not.toHaveBeenCalled()
    await expect(runtime.modules[0]?.routes[0]?.load()).resolves.toBe(factory)
    await expect(runtime.modules[0]?.load()).resolves.toEqual([factory])
    await expect(runtime.modules[0]?.routes[1]?.load()).resolves.toBe(factory)
    expect(importRuntime).toHaveBeenCalledTimes(1)
  })

  it("loads typed package exports for non-route facets by stable reference id", async () => {
    const provider = { kind: "ledger-provider" }
    const tool = () => "adjusted"
    const importRuntime = vi.fn(async () => ({ provider, tool }))
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:test",
      entries: { "@acme/loyalty/runtime": importRuntime },
      modules: [
        {
          id: "@acme/loyalty",
          kind: "module",
          packageName: "@acme/loyalty",
          order: 0,
          references: [
            {
              id: "loyalty-provider",
              unitId: "@acme/loyalty",
              facet: "providers.runtime",
              entityId: "provider",
              runtime: { entry: "./runtime", export: "provider" },
              importEntry: "@acme/loyalty/runtime",
            },
            {
              id: "loyalty-tool",
              unitId: "@acme/loyalty",
              facet: "tools.runtime",
              entityId: "tool",
              runtime: { entry: "./runtime", export: "tool" },
              importEntry: "@acme/loyalty/runtime",
            },
          ],
          routes: [],
        },
      ],
      plugins: [],
    })

    expect(importRuntime).not.toHaveBeenCalled()
    await expect(runtime.loadReference<typeof provider>("loyalty-provider")).resolves.toBe(provider)
    await expect(runtime.loadReference<typeof tool>("loyalty-tool")).resolves.toBe(tool)
    expect(runtime.references.map((reference) => reference.facet)).toEqual([
      "providers.runtime",
      "tools.runtime",
    ])
    expect(importRuntime).toHaveBeenCalledTimes(1)
  })

  it("exposes selected access scopes and lazily registers selected graph tools", async () => {
    const tool = {
      name: "adjust_loyalty",
      description: "Adjust loyalty points",
      inputSchema: {},
      outputSchema: {},
      requiredScopes: ["loyalty:write"],
      tier: "medium",
      riskPolicy: {
        destructive: false,
        reversible: true,
        dryRun: false,
        sideEffects: ["database_write"],
      },
      handler: async () => ({ ok: true }),
    }
    const importRuntime = vi.fn(async () => ({ adjustLoyalty: tool }))
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:test",
      entries: { "@acme/loyalty/tools": importRuntime },
      modules: [
        {
          id: "@acme/loyalty",
          kind: "module",
          packageName: "@acme/loyalty",
          order: 0,
          accessScopes: ["loyalty:read", "loyalty:write"],
          references: [
            {
              id: "loyalty-tool-runtime",
              unitId: "@acme/loyalty",
              facet: "tools.runtime",
              entityId: "loyalty-tool",
              runtime: { entry: "./tools", export: "adjustLoyalty" },
              importEntry: "@acme/loyalty/tools",
            },
          ],
          tools: [
            {
              id: "loyalty-tool",
              unitId: "@acme/loyalty",
              name: "adjust_loyalty",
              referenceId: "loyalty-tool-runtime",
              requiredScopes: ["loyalty:write"],
              context: ["loyalty"],
              risk: "medium",
            },
          ],
          routes: [],
        },
      ],
      plugins: [],
    })

    expect(runtime.accessScopes).toEqual(["loyalty:read", "loyalty:write"])
    expect(runtime.tools.map(({ id }) => id)).toEqual(["loyalty-tool"])
    expect(importRuntime).not.toHaveBeenCalled()

    const registry = createToolRegistry()
    await registerVoyantGraphTools(runtime, registry)

    expect(registry.names()).toEqual(["adjust_loyalty"])
    expect(importRuntime).toHaveBeenCalledTimes(1)
  })

  it("rejects undeclared tool scopes before evaluating package imports", () => {
    const importRuntime = vi.fn(async () => ({}))

    expect(() =>
      createVoyantGraphRuntime({
        graphHash: "sha256:test",
        entries: { "@acme/loyalty/tools": importRuntime },
        modules: [
          {
            id: "@acme/loyalty",
            kind: "module",
            packageName: "@acme/loyalty",
            order: 0,
            accessScopes: ["loyalty:read"],
            references: [
              {
                id: "loyalty-tool-runtime",
                unitId: "@acme/loyalty",
                facet: "tools.runtime",
                entityId: "loyalty-tool",
                runtime: { entry: "./tools", export: "adjustLoyalty" },
                importEntry: "@acme/loyalty/tools",
              },
            ],
            tools: [
              {
                id: "loyalty-tool",
                unitId: "@acme/loyalty",
                name: "adjust_loyalty",
                referenceId: "loyalty-tool-runtime",
                requiredScopes: ["loyalty:write"],
              },
            ],
            routes: [],
          },
        ],
        plugins: [],
      }),
    ).toThrow(/tool "loyalty-tool" requires undeclared access scope "loyalty:write"/)
    expect(importRuntime).not.toHaveBeenCalled()
  })

  it("rejects unknown reference ids before evaluating package imports", async () => {
    const importRuntime = vi.fn(async () => ({ createLoyaltyModule: {} }))
    const runtime = createVoyantGraphRuntime(runtimeInput(importRuntime))

    await expect(runtime.loadReference("not-admitted")).rejects.toMatchObject({
      code: "VOYANT_GRAPH_RUNTIME_REFERENCE_UNKNOWN",
      context: { referenceId: "not-admitted" },
    })
    expect(importRuntime).not.toHaveBeenCalled()
  })

  it("does not mutate reusable generated runtime definitions", () => {
    const input = runtimeInput(async () => ({ createLoyaltyModule: {} }))

    expect(() => createVoyantGraphRuntime(input)).not.toThrow()
    expect(() => createVoyantGraphRuntime(input)).not.toThrow()
    expect(input.modules[0]?.routes[0]).not.toHaveProperty("referenceId")
  })

  it("reports a missing package export with graph unit and route context", async () => {
    const runtime = createVoyantGraphRuntime(runtimeInput(async () => ({ otherExport: {} })))

    const error = await runtime.modules[0]?.load().catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(VoyantGraphRuntimeLoadError)
    expect(error).toMatchObject({
      code: "VOYANT_GRAPH_RUNTIME_EXPORT_MISSING",
      context: {
        unitId: "@acme/voyant-loyalty",
        routeId: "@acme/voyant-loyalty#api.admin",
        entry: "@acme/voyant-loyalty/runtime",
        exportName: "createLoyaltyModule",
      },
    })
    expect(String(error)).toContain('export "createLoyaltyModule" was not found')
  })

  it("reports invalid exports and package import failures distinctly", async () => {
    const invalid = createVoyantGraphRuntime(
      runtimeInput(async () => ({ createLoyaltyModule: "not-a-runtime-unit" })),
    )
    await expect(invalid.modules[0]?.load()).rejects.toMatchObject({
      code: "VOYANT_GRAPH_RUNTIME_EXPORT_INVALID",
    })

    const failed = createVoyantGraphRuntime(
      runtimeInput(async () => {
        throw new Error("package initialization failed")
      }),
    )
    await expect(failed.modules[0]?.load()).rejects.toMatchObject({
      code: "VOYANT_GRAPH_RUNTIME_IMPORT_FAILED",
      cause: expect.objectContaining({ message: "package initialization failed" }),
    })
  })
})

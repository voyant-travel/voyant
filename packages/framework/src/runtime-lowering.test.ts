import { describe, expect, it, vi } from "vitest"
import { createVoyantGraphRuntime, VoyantGraphRuntimeLoadError } from "./runtime-lowering.js"

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

import { describe, expect, it, vi } from "vitest"
import { composeVoyantGraphRuntime } from "./runtime-composition.js"
import { createVoyantGraphRuntime } from "./runtime-lowering.js"

function runtimeWithDuplicateFacets(load: () => Promise<unknown>) {
  return createVoyantGraphRuntime({
    graphHash: "sha256:test",
    entries: { "@acme/loyalty": load },
    modules: [
      {
        id: "@acme/loyalty",
        kind: "module",
        packageName: "@acme/loyalty",
        order: 0,
        routes: ["admin", "public"].map((surface) => ({
          route: {
            id: `@acme/loyalty#api.${surface}`,
            surface: surface as "admin" | "public",
            runtime: { entry: "@acme/loyalty", export: "createLoyaltyModule" },
          },
          importEntry: "@acme/loyalty",
        })),
      },
      {
        id: "operator/invitations",
        kind: "module",
        packageName: "@acme/operator",
        order: 1,
        routes: [],
      },
    ],
    plugins: [],
  })
}

describe("graph runtime composition", () => {
  it("mounts a package runtime export once when multiple API facets reference it", async () => {
    const factory = vi.fn(() => ({ module: { name: "loyalty" } }))
    const importRuntime = vi.fn(async () => ({ createLoyaltyModule: factory }))

    const composition = await composeVoyantGraphRuntime({
      runtime: runtimeWithDuplicateFacets(importRuntime),
      capabilities: {},
    })

    expect(composition.modules.map((module) => module.module.name)).toEqual(["loyalty"])
    expect(importRuntime).toHaveBeenCalledTimes(1)
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it("uses selected ID bindings for option-bearing factories and local units", async () => {
    const configuredFactory = vi.fn((options: { prefix: string }) => ({
      module: { name: options.prefix },
    }))
    const localBinding = vi.fn(() => ({ module: { name: "invitations" } }))

    const composition = await composeVoyantGraphRuntime({
      runtime: runtimeWithDuplicateFacets(async () => ({
        createLoyaltyModule: configuredFactory,
      })),
      capabilities: { prefix: "configured-loyalty" },
      bindings: {
        "@acme/loyalty": ({ capabilities, runtimeExports }) =>
          (runtimeExports[0] as typeof configuredFactory)({ prefix: capabilities.prefix }),
        "operator/invitations": localBinding,
      },
    })

    expect(composition.modules.map((module) => module.module.name)).toEqual([
      "configured-loyalty",
      "invitations",
    ])
    expect(configuredFactory).toHaveBeenCalledTimes(1)
    expect(localBinding).toHaveBeenCalledTimes(1)
  })

  it("does not run or mount a binding when its unit is absent from the graph", async () => {
    const removedBinding = vi.fn(() => ({ module: { name: "removed" } }))
    const runtime = runtimeWithDuplicateFacets(async () => ({
      createLoyaltyModule: () => ({ module: { name: "loyalty" } }),
    }))

    const composition = await composeVoyantGraphRuntime({
      runtime,
      capabilities: {},
      bindings: { "@acme/removed": removedBinding },
    })

    expect(composition.modules.map((module) => module.module.name)).toEqual(["loyalty"])
    expect(removedBinding).not.toHaveBeenCalled()
  })

  it("rejects plugin runtime exports that are not Hono extensions", async () => {
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:test",
      entries: { "@acme/audit": async () => ({ audit: { module: { name: "wrong" } } }) },
      modules: [],
      plugins: [
        {
          id: "@acme/audit",
          kind: "plugin",
          packageName: "@acme/audit",
          order: 0,
          routes: [
            {
              route: {
                id: "@acme/audit#api",
                surface: "admin",
                runtime: { entry: "@acme/audit", export: "audit" },
              },
              importEntry: "@acme/audit",
            },
          ],
        },
      ],
    })

    await expect(composeVoyantGraphRuntime({ runtime, capabilities: {} })).rejects.toThrow(
      /plugin "@acme\/audit" must resolve to HonoExtension/,
    )
  })
})

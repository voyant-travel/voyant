import {
  defineGraphRuntimeFactory,
  definePort,
  type VoyantGraphJsonObject,
  type VoyantGraphRuntimeFactoryContext,
  type VoyantPort,
} from "@voyant-travel/core/project"
import { describe, expect, expectTypeOf, it, vi } from "vitest"

import { composeVoyantGraphRuntime, type VoyantGraphRuntimePorts } from "./runtime-composition.js"
import { createVoyantGraphRuntime } from "./runtime-lowering.js"

interface RuntimeProvider {
  readonly moduleName: string
}

const runtimePort = definePort<RuntimeProvider>({
  id: "acme.runtime",
  test(provider) {
    if (!provider.moduleName) throw new Error("moduleName required")
  },
})

function runtimeWithApiFactory(
  factory: ReturnType<typeof defineGraphRuntimeFactory>,
  options: {
    projectConfig?: VoyantGraphJsonObject
    runtimePorts?: readonly Pick<VoyantPort<never>, "id">[]
    requiredRuntimePorts?: readonly string[]
  } = {},
) {
  const unitId = "@acme/runtime-context"
  const entry = `${unitId}/runtime`
  return createVoyantGraphRuntime({
    graphHash: "sha256:runtime-factory-context",
    entries: { [entry]: async () => ({ factory }) },
    modules: [
      {
        id: unitId,
        kind: "module",
        packageName: "@acme/runtime-context",
        order: 0,
        ...(options.projectConfig ? { projectConfig: options.projectConfig } : {}),
        runtimePorts: (options.runtimePorts ?? []).map((port) => port.id),
        ...(options.requiredRuntimePorts
          ? { requiredRuntimePorts: options.requiredRuntimePorts }
          : {}),
        references: [
          {
            id: `${unitId}#api.admin:runtime`,
            unitId,
            facet: "api",
            entityId: `${unitId}#api.admin`,
            runtime: { entry, export: "factory" },
            importEntry: entry,
          },
        ],
        selectedIds: {
          routes: [`${unitId}#api.admin`],
          tools: [],
          events: [],
          webhooks: [],
        },
        routes: [
          {
            route: {
              id: `${unitId}#api.admin`,
              surface: "admin",
              runtime: { entry, export: "factory" },
            },
            importEntry: entry,
            referenceId: `${unitId}#api.admin:runtime`,
          },
        ],
      },
    ],
    plugins: [],
  })
}

async function composeFactory(
  factory: ReturnType<typeof defineGraphRuntimeFactory>,
  options: Parameters<typeof runtimeWithApiFactory>[1] = {},
  ports?: VoyantGraphRuntimePorts,
) {
  return composeVoyantGraphRuntime({
    runtime: runtimeWithApiFactory(factory, options),
    capabilities: {},
    ...(ports ? { ports } : {}),
  })
}

describe("graph runtime factory context", () => {
  it("shares one typed context across API and subscriber facets", async () => {
    const contexts: VoyantGraphRuntimeFactoryContext[] = []
    const projectConfig = { display: { label: "Alerts" } } as const
    const apiFactory = defineGraphRuntimeFactory(async (context) => {
      contexts.push(context)
      expectTypeOf(context.projectConfig).toEqualTypeOf<Readonly<VoyantGraphJsonObject>>()
      const provider = await context.getPort(runtimePort)
      expectTypeOf(provider).toEqualTypeOf<RuntimeProvider>()
      return { module: { name: provider.moduleName } }
    })
    const subscriberFactory = defineGraphRuntimeFactory((context) => {
      contexts.push(context)
      return {
        id: "@acme/alerts#subscriber.booking-confirmed",
        eventType: "booking.confirmed",
        register: vi.fn(),
      }
    })
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:shared-runtime-factory-context",
      entries: {
        "@acme/alerts/api": async () => ({ apiFactory }),
        "@acme/alerts/subscriber": async () => ({ subscriberFactory }),
      },
      modules: [
        {
          id: "@acme/alerts",
          kind: "module",
          packageName: "@acme/alerts",
          order: 0,
          projectConfig,
          runtimePorts: [runtimePort.id],
          references: [
            {
              id: "alerts-api",
              unitId: "@acme/alerts",
              facet: "api",
              entityId: "@acme/alerts#api.admin",
              runtime: { entry: "./api", export: "apiFactory" },
              importEntry: "@acme/alerts/api",
            },
            {
              id: "alerts-subscriber",
              unitId: "@acme/alerts",
              facet: "subscribers.runtime",
              entityId: "@acme/alerts#subscriber.booking-confirmed",
              runtime: { entry: "./subscriber", export: "subscriberFactory" },
              importEntry: "@acme/alerts/subscriber",
            },
          ],
          selectedIds: {
            routes: ["@acme/alerts#api.admin"],
            tools: [],
            events: [],
            webhooks: [],
          },
          routes: [
            {
              route: {
                id: "@acme/alerts#api.admin",
                surface: "admin",
                runtime: { entry: "./api", export: "apiFactory" },
              },
              importEntry: "@acme/alerts/api",
              referenceId: "alerts-api",
            },
          ],
        },
      ],
      plugins: [],
    })

    const composition = await composeVoyantGraphRuntime({
      runtime,
      capabilities: {},
      ports: { [runtimePort.id]: { moduleName: "alerts" } },
    })

    expect(composition.modules.map((module) => module.module.name)).toEqual([
      "alerts",
      "@acme/alerts.graph-runtime",
    ])
    expect(contexts).toHaveLength(2)
    expect(contexts[0]).toBe(contexts[1])
    expect(contexts[0]?.projectConfig).toBe(runtime.modules[0]?.projectConfig)
    expect(contexts[0]?.projectConfig).toEqual(projectConfig)
    expect(contexts[0]?.graph).toBe(runtime)
    expect(contexts[0]?.runtimePorts).toEqual({
      [runtimePort.id]: { moduleName: "alerts" },
    })
  })

  it("rejects undeclared, missing required, and missing optional ports", async () => {
    const undeclaredPort = definePort<unknown>({ id: "acme.undeclared", test: () => {} })
    const undeclaredFactory = defineGraphRuntimeFactory(({ hasPort }) => {
      hasPort(undeclaredPort)
      return { module: { name: "unreachable" } }
    })
    await expect(composeFactory(undeclaredFactory)).rejects.toThrow(
      /requested undeclared port "acme\.undeclared"/,
    )

    const requiredFactory = defineGraphRuntimeFactory(async ({ getPort }) => {
      await getPort(runtimePort)
      return { module: { name: "unreachable" } }
    })
    await expect(composeFactory(requiredFactory, { runtimePorts: [runtimePort] })).rejects.toThrow(
      /requires runtime port "acme\.runtime"/,
    )

    await expect(
      composeFactory(requiredFactory, {
        runtimePorts: [runtimePort],
        requiredRuntimePorts: [],
      }),
    ).rejects.toThrow(/optional runtime port "acme\.runtime"/)

    const optionalFactory = defineGraphRuntimeFactory(({ hasPort }) => ({
      module: { name: hasPort(runtimePort) ? "bound" : "fallback" },
    }))
    await expect(
      composeFactory(optionalFactory, {
        runtimePorts: [runtimePort],
        requiredRuntimePorts: [],
      }),
    ).resolves.toMatchObject({ modules: [{ module: { name: "fallback" } }] })
  })

  it("keeps port bindings lazy and rejects invalid providers on access", async () => {
    const resolveBinding = vi.fn((resolve: (provider: RuntimeProvider) => void) =>
      resolve({ moduleName: "lazy-runtime" }),
    )
    // biome-ignore lint/suspicious/noThenProperty: an explicit thenable proves composition does not resolve bindings before getPort.
    const lazyBinding = { then: resolveBinding }
    const factory = defineGraphRuntimeFactory(async ({ getPort, hasPort }) => {
      expect(hasPort(runtimePort)).toBe(true)
      expect(resolveBinding).not.toHaveBeenCalled()
      const provider = await getPort(runtimePort)
      return { module: { name: provider.moduleName } }
    })

    await expect(
      composeFactory(factory, { runtimePorts: [runtimePort] }, { [runtimePort.id]: lazyBinding }),
    ).resolves.toMatchObject({ modules: [{ module: { name: "lazy-runtime" } }] })
    expect(resolveBinding).toHaveBeenCalledOnce()
    resolveBinding.mockClear()

    await expect(
      composeFactory(
        factory,
        { runtimePorts: [runtimePort] },
        { [runtimePort.id]: { moduleName: "" } },
      ),
    ).rejects.toThrow("moduleName required")
  })

  it("does not import deselected factories or resolve their port bindings", async () => {
    const importRuntime = vi.fn(async () => ({
      factory: defineGraphRuntimeFactory(() => ({ module: { name: "deselected" } })),
    }))
    const resolveBinding = vi.fn()
    // biome-ignore lint/suspicious/noThenProperty: an explicit thenable makes accidental deselected binding resolution observable.
    const deselectedBinding = { then: resolveBinding }
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:deselected-runtime-context",
      entries: { "@acme/deselected/runtime": importRuntime },
      modules: [],
      plugins: [],
    })

    await expect(
      composeVoyantGraphRuntime({
        runtime,
        capabilities: {},
        ports: { [runtimePort.id]: deselectedBinding },
      }),
    ).resolves.toMatchObject({ modules: [], extensions: [] })
    expect(importRuntime).not.toHaveBeenCalled()
    expect(resolveBinding).not.toHaveBeenCalled()
  })

  it("exposes owning config directly and selected unit config by exact id", async () => {
    const seen = new Map<string, VoyantGraphRuntimeFactoryContext>()
    const entries: Record<string, () => Promise<unknown>> = {}
    const modules = ["alpha", "beta"].map((name, order) => {
      const unitId = `@acme/${name}`
      const entry = `${unitId}/runtime`
      const factory = defineGraphRuntimeFactory((context) => {
        seen.set(name, context)
        return { module: { name } }
      })
      entries[entry] = async () => ({ factory })
      return {
        id: unitId,
        kind: "module" as const,
        packageName: unitId,
        order,
        projectConfig: { owner: name, privateValue: `${name}-only` },
        references: [
          {
            id: `${unitId}#api.admin:runtime`,
            unitId,
            facet: "api" as const,
            entityId: `${unitId}#api.admin`,
            runtime: { entry, export: "factory" },
            importEntry: entry,
          },
        ],
        selectedIds: {
          routes: [`${unitId}#api.admin`],
          tools: [],
          events: [],
          webhooks: [],
        },
        routes: [
          {
            route: {
              id: `${unitId}#api.admin`,
              surface: "admin" as const,
              runtime: { entry, export: "factory" },
            },
            importEntry: entry,
            referenceId: `${unitId}#api.admin:runtime`,
          },
        ],
      }
    })
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:project-config-isolation",
      entries,
      modules,
      plugins: [],
    })

    await composeVoyantGraphRuntime({ runtime, capabilities: {} })

    expect(seen.get("alpha")?.projectConfig).toEqual({
      owner: "alpha",
      privateValue: "alpha-only",
    })
    expect(seen.get("beta")?.projectConfig).toEqual({
      owner: "beta",
      privateValue: "beta-only",
    })
    expect(seen.get("alpha")?.projectConfig).toBe(runtime.modules[0]?.projectConfig)
    expect(seen.get("beta")?.projectConfig).toBe(runtime.modules[1]?.projectConfig)
    expect(seen.get("alpha")?.getUnitProjectConfig("@acme/beta")).toBe(
      runtime.modules[1]?.projectConfig,
    )
    expect(seen.get("alpha")?.getUnitProjectConfig("@acme/not-selected")).toBeUndefined()
  })
})

// agent-quality: file-size exception -- owner: framework; graph unit, facet, port, route posture, and plugin output contracts share one composition harness.
import { createEventBus } from "@voyant-travel/core"
import { defineGraphRuntimeFactory, definePort } from "@voyant-travel/core/project"
import { describe, expect, it, vi } from "vitest"
import {
  composeVoyantGraphRuntime,
  createVoyantGraphRuntimePortStubs,
} from "./runtime-composition.js"
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
  it("creates conforming non-thenable stubs for package-owned runtime ports", () => {
    const graphRuntime = createVoyantGraphRuntime({
      graphHash: "sha256:runtime-port-stub",
      entries: {},
      modules: [
        {
          id: "@acme/identity",
          kind: "module",
          packageName: "@acme/identity",
          order: 0,
          requiredRuntimePorts: ["acme.identity-runtime"],
          routes: [],
        },
      ],
      plugins: [],
    })

    const provider = createVoyantGraphRuntimePortStubs(graphRuntime)[
      "acme.identity-runtime"
    ] as Record<string, unknown>

    expect(provider.then).toBeUndefined()
    expect(typeof provider.resolveDeployment).toBe("function")
    expect(typeof provider.resolveSourceAdapterRegistry).toBe("function")
    expect(provider.settings).toBeUndefined()
  })

  it("registers outbound subscribers from graph selections without a deployment event catalog", async () => {
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:webhook-runtime",
      entries: {},
      modules: [
        {
          id: "@acme/catalog",
          kind: "module",
          packageName: "@acme/catalog",
          order: 0,
          routes: [],
        },
      ],
      plugins: [],
      webhookPlan: {
        inbound: [],
        outbound: [
          {
            id: "@acme/catalog#webhook.updated",
            unitId: "@acme/catalog",
            packageName: "@acme/catalog",
            eventId: "@acme/catalog#event.updated",
            eventUnitId: "@acme/catalog",
            eventType: "catalog.entity.updated",
            eventVersion: "1.0.0",
            payloadSchema: { type: "object", properties: {} },
            visibility: "external",
            audit: { sourceModule: "catalog", category: "domain" },
            secretIds: [],
          },
        ],
      },
    })
    const enqueue = vi.fn(async () => {})
    const composition = await composeVoyantGraphRuntime({
      runtime,
      capabilities: {},
      outboundWebhooks: { enqueue },
    })
    const module = composition.modules.find(
      (candidate) => candidate.module.name === "graph-outbound-webhooks",
    )
    const eventBus = createEventBus()
    await module?.module.bootstrap?.({ bindings: { deployment: "node" }, eventBus } as never)

    await eventBus.emit("catalog.entity.updated", { entity_id: "prod_1" })
    await eventBus.emit("catalog.entity.deleted", { entity_id: "prod_1" })

    expect(enqueue).toHaveBeenCalledOnce()
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "catalog.entity.updated",
        metadata: expect.objectContaining({
          eventId: expect.stringMatching(/^evt_/),
          category: "domain",
          graphEventId: "@acme/catalog#event.updated",
          graphEventVersion: "1.0.0",
          graphEventPayloadSchema: { type: "object", properties: {} },
          graphEventSourceModule: "catalog",
        }),
      }),
      { deployment: "node" },
    )
  })
  it("requires selected inbound webhook APIs to execute through webhookRoutes", async () => {
    const createRuntime = (webhookRoutes: unknown) =>
      createVoyantGraphRuntime({
        graphHash: "sha256:webhook-posture",
        entries: {
          "@acme/hooks": async () => ({
            createHooksModule: () => ({ module: { name: "hooks" }, webhookRoutes }),
          }),
        },
        modules: [
          {
            id: "@acme/hooks",
            kind: "module",
            packageName: "@acme/hooks",
            order: 0,
            routes: [
              {
                route: {
                  id: "@acme/hooks#api.inbound",
                  surface: "webhook",
                  runtime: { entry: "@acme/hooks", export: "createHooksModule" },
                },
                importEntry: "@acme/hooks",
              },
            ],
          },
        ],
        plugins: [],
        webhookPlan: {
          inbound: [
            {
              id: "@acme/hooks#webhook.inbound",
              unitId: "@acme/hooks",
              packageName: "@acme/hooks",
              apiId: "@acme/hooks#api.inbound",
              apiUnitId: "@acme/hooks",
              mountPath: "/v1/hooks",
              secretIds: [],
            },
          ],
          outbound: [],
        },
      })

    await expect(
      composeVoyantGraphRuntime({ runtime: createRuntime({}), capabilities: {} }),
    ).resolves.toMatchObject({ modules: [{ module: { name: "hooks" } }] })
    await expect(
      composeVoyantGraphRuntime({ runtime: createRuntime(undefined), capabilities: {} }),
    ).rejects.toThrow(/inbound webhook plan.*no webhookRoutes/)
  })

  it("registers graph-selected workflow and subscriber runtime exports", async () => {
    const workflow = {
      id: "promotions.reindex-all-products",
      config: { id: "promotions.reindex-all-products", run: vi.fn() },
    }
    const eventFilter = {
      id: "ef_6f8e4b4ce409d04c",
      eventType: "promotion.changed",
      manifest: {
        id: "ef_6f8e4b4ce409d04c",
        eventType: "promotion.changed",
        payloadHash: "6f8e4b4ce409d04c",
        targetWorkflowId: workflow.id,
      },
    }
    const importWorkflow = vi.fn(async () => ({ workflow }))
    const importSubscriber = vi.fn(async () => ({ eventFilter }))
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:commerce",
      entries: {
        "@voyant-travel/commerce/promotions/workflow": importWorkflow,
        "@voyant-travel/commerce/promotions/subscriber": importSubscriber,
      },
      modules: [
        {
          id: "@voyant-travel/commerce",
          localId: "commerce",
          kind: "module",
          packageName: "@voyant-travel/commerce",
          order: 0,
          references: [
            {
              id: "commerce-workflow",
              unitId: "@voyant-travel/commerce",
              facet: "workflows.runtime",
              entityId: workflow.id,
              runtime: {
                entry: "./promotions/workflow",
                export: "workflow",
              },
              importEntry: "@voyant-travel/commerce/promotions/workflow",
            },
            {
              id: "commerce-subscriber",
              unitId: "@voyant-travel/commerce",
              facet: "subscribers.runtime",
              entityId: eventFilter.id,
              runtime: {
                entry: "./promotions/subscriber",
                export: "eventFilter",
              },
              importEntry: "@voyant-travel/commerce/promotions/subscriber",
            },
          ],
          workflows: [
            {
              unitId: "@voyant-travel/commerce",
              declaration: {
                id: workflow.id,
                runtime: {
                  entry: "./promotions/workflow",
                  export: "workflow",
                },
              },
              referenceId: "commerce-workflow",
            },
          ],
          routes: [],
        },
      ],
      plugins: [],
    })

    expect(importWorkflow).not.toHaveBeenCalled()
    expect(importSubscriber).not.toHaveBeenCalled()

    const composition = await composeVoyantGraphRuntime({ runtime, capabilities: {} })

    expect(composition.modules).toContainEqual({
      module: {
        name: "commerce.graph-runtime",
        workflows: [workflow],
        eventFilters: [eventFilter],
      },
    })
    expect(importWorkflow).toHaveBeenCalledTimes(1)
    expect(importSubscriber).toHaveBeenCalledTimes(1)
  })

  it("registers ordinary graph subscribers without treating them as workflow filters", async () => {
    const handler = vi.fn(async () => {})
    const subscriber = {
      id: "@acme/alerts#subscriber.booking-confirmed",
      eventType: "booking.confirmed",
      register: vi.fn(({ eventBus }) => {
        eventBus.subscribe("booking.confirmed", handler)
      }),
    }
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:subscriber-runtime",
      entries: {
        "@acme/alerts/subscribers": async () => ({ subscriber }),
      },
      modules: [
        {
          id: "@acme/alerts",
          localId: "alerts",
          kind: "module",
          packageName: "@acme/alerts",
          order: 0,
          references: [
            {
              id: "alerts-subscriber",
              unitId: "@acme/alerts",
              facet: "subscribers.runtime",
              entityId: subscriber.id,
              runtime: { entry: "./subscribers", export: "subscriber" },
              importEntry: "@acme/alerts/subscribers",
            },
          ],
          routes: [],
        },
      ],
      plugins: [],
    })

    const composition = await composeVoyantGraphRuntime({ runtime, capabilities: {} })
    const module = composition.modules.find(
      (candidate) => candidate.module.name === "alerts.graph-runtime",
    )
    const eventBus = createEventBus()

    expect(module?.module.eventFilters).toBeUndefined()
    await module?.module.bootstrap?.({ bindings: {}, container: {} as never, eventBus })
    await eventBus.emit("booking.confirmed", { bookingId: "booking_1" })

    expect(subscriber.register).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledOnce()
  })

  it("rejects an ordinary subscriber runtime with a mismatched graph id", async () => {
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:subscriber-runtime-mismatch",
      entries: {
        "@acme/alerts/subscribers": async () => ({
          subscriber: {
            id: "@acme/alerts#subscriber.wrong",
            eventType: "booking.confirmed",
            register: vi.fn(),
          },
        }),
      },
      modules: [
        {
          id: "@acme/alerts",
          kind: "module",
          packageName: "@acme/alerts",
          order: 0,
          references: [
            {
              id: "alerts-subscriber",
              unitId: "@acme/alerts",
              facet: "subscribers.runtime",
              entityId: "@acme/alerts#subscriber.booking-confirmed",
              runtime: { entry: "./subscribers", export: "subscriber" },
              importEntry: "@acme/alerts/subscribers",
            },
          ],
          routes: [],
        },
      ],
      plugins: [],
    })

    await expect(composeVoyantGraphRuntime({ runtime, capabilities: {} })).rejects.toThrow(
      /does not match graph subscriber/,
    )
  })

  it("loads legacy workflow facet references when generated workflow loaders are absent", async () => {
    const workflow = {
      id: "commerce.reconcile",
      config: { id: "commerce.reconcile", run: vi.fn() },
    }
    const importWorkflow = vi.fn(async () => ({ workflow }))
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:legacy-workflow-reference",
      entries: { "@voyant-travel/commerce/workflows": importWorkflow },
      modules: [
        {
          id: "@voyant-travel/commerce",
          localId: "commerce",
          kind: "module",
          packageName: "@voyant-travel/commerce",
          order: 0,
          references: [
            {
              id: "commerce-workflow",
              unitId: "@voyant-travel/commerce",
              facet: "workflows.runtime",
              entityId: workflow.id,
              runtime: { entry: "./workflows", export: "workflow" },
              importEntry: "@voyant-travel/commerce/workflows",
            },
          ],
          routes: [],
        },
      ],
      plugins: [],
    })

    expect(runtime.modules[0]?.workflows).toEqual([])
    const composition = await composeVoyantGraphRuntime({ runtime, capabilities: {} })

    expect(composition.modules).toContainEqual({
      module: { name: "commerce.graph-runtime", workflows: [workflow] },
    })
    expect(importWorkflow).toHaveBeenCalledOnce()
  })

  it("keeps workflow exports out of primary module bindings", async () => {
    const createCommerceModule = vi.fn(() => ({ module: { name: "commerce" } }))
    const reconcileWorkflow = {
      id: "commerce.reconcile",
      config: { id: "commerce.reconcile", run: vi.fn() },
    }
    const importRuntime = vi.fn(async () => ({ createCommerceModule, reconcileWorkflow }))
    const binding = vi.fn(({ runtimeExports }: { runtimeExports: readonly unknown[] }) => {
      expect(runtimeExports).toEqual([createCommerceModule])
      return createCommerceModule()
    })
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:facet-specific-workflows",
      entries: { "@voyant-travel/commerce/runtime": importRuntime },
      modules: [
        {
          id: "@voyant-travel/commerce",
          kind: "module",
          packageName: "@voyant-travel/commerce",
          order: 0,
          runtimeReferenceId: "commerce-runtime",
          references: [
            {
              id: "commerce-runtime",
              unitId: "@voyant-travel/commerce",
              facet: "runtime",
              entityId: "@voyant-travel/commerce",
              runtime: { entry: "./runtime", export: "createCommerceModule" },
              importEntry: "@voyant-travel/commerce/runtime",
            },
            {
              id: "commerce-workflow",
              unitId: "@voyant-travel/commerce",
              facet: "workflows.runtime",
              entityId: reconcileWorkflow.id,
              runtime: { entry: "./runtime", export: "reconcileWorkflow" },
              importEntry: "@voyant-travel/commerce/runtime",
            },
          ],
          workflows: [
            {
              unitId: "@voyant-travel/commerce",
              declaration: {
                id: reconcileWorkflow.id,
                runtime: { entry: "./runtime", export: "reconcileWorkflow" },
              },
              referenceId: "commerce-workflow",
            },
          ],
          routes: [],
        },
      ],
      plugins: [],
    })

    expect(importRuntime).not.toHaveBeenCalled()
    const composition = await composeVoyantGraphRuntime({
      runtime,
      capabilities: {},
      bindings: { "@voyant-travel/commerce": binding },
    })

    expect(binding).toHaveBeenCalledOnce()
    expect(composition.modules).toEqual([
      { module: { name: "commerce" } },
      {
        module: {
          name: "@voyant-travel/commerce.graph-runtime",
          workflows: [reconcileWorkflow],
        },
      },
    ])
    expect(importRuntime).toHaveBeenCalledTimes(1)
  })

  it("does not import or register workflow facets for an unselected package", async () => {
    const importCommerce = vi.fn(async () => ({
      bulkReindexProductsWorkflow: { id: "promotions.reindex-all-products" },
    }))
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:without-commerce",
      entries: {
        "@voyant-travel/commerce/product-reindex-workflow": importCommerce,
      },
      modules: [],
      plugins: [],
    })

    const composition = await composeVoyantGraphRuntime({ runtime, capabilities: {} })

    expect(composition.modules).toEqual([])
    expect(importCommerce).not.toHaveBeenCalled()
  })

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

  it("passes only selected API facets to a package runtime factory", async () => {
    const factory = defineGraphRuntimeFactory(vi.fn(() => ({ module: { name: "loyalty" } })))
    const importRuntime = vi.fn(async () => ({ createLoyaltyModule: factory }))
    const runtime = runtimeWithDuplicateFacets(importRuntime)
    const adminOnlyRuntime = {
      ...runtime,
      modules: runtime.modules.map((unit) => ({
        ...unit,
        routes: unit.routes.filter(({ route }) => route.surface === "admin"),
      })),
    }

    await composeVoyantGraphRuntime({ runtime: adminOnlyRuntime, capabilities: {} })

    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({
        api: [{ id: "@acme/loyalty#api.admin", surface: "admin" }],
      }),
    )
  })

  it("injects only manifest-declared runtime ports into package-owned factories", async () => {
    const loyaltyPort = definePort<{ prefix: string }>({ id: "loyalty.runtime", test: () => {} })
    const factory = defineGraphRuntimeFactory(
      vi.fn(async ({ getPort }) => {
        const provider = await getPort(loyaltyPort)
        return { module: { name: provider.prefix } }
      }),
    )
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:runtime-port",
      entries: { "@acme/loyalty": async () => ({ createLoyaltyModule: factory }) },
      modules: [
        {
          id: "@acme/loyalty",
          kind: "module",
          packageName: "@acme/loyalty",
          order: 0,
          runtimePorts: [loyaltyPort.id],
          routes: [
            {
              route: {
                id: "@acme/loyalty#api",
                surface: "admin",
                runtime: { entry: "@acme/loyalty", export: "createLoyaltyModule" },
              },
              importEntry: "@acme/loyalty",
            },
          ],
        },
      ],
      plugins: [],
    })

    const composition = await composeVoyantGraphRuntime({
      runtime,
      capabilities: {},
      ports: { [loyaltyPort.id]: Promise.resolve({ prefix: "loyalty" }) },
    })

    expect(composition.modules).toEqual([{ module: { name: "loyalty" } }])
    expect(factory).toHaveBeenCalledOnce()
  })

  it("rejects missing and undeclared package runtime ports", async () => {
    const declaredPort = definePort<unknown>({ id: "loyalty.runtime", test: () => {} })
    const undeclaredPort = definePort<unknown>({ id: "billing.runtime", test: () => {} })
    const createRuntime = (port: typeof declaredPort) =>
      createVoyantGraphRuntime({
        graphHash: "sha256:invalid-runtime-port",
        entries: {
          "@acme/loyalty": async () => ({
            createLoyaltyModule: defineGraphRuntimeFactory(async ({ getPort }) => {
              await getPort(port)
              return { module: { name: "loyalty" } }
            }),
          }),
        },
        modules: [
          {
            id: "@acme/loyalty",
            kind: "module",
            packageName: "@acme/loyalty",
            order: 0,
            runtimePorts: [declaredPort.id],
            routes: [
              {
                route: {
                  id: "@acme/loyalty#api",
                  surface: "admin",
                  runtime: { entry: "@acme/loyalty", export: "createLoyaltyModule" },
                },
                importEntry: "@acme/loyalty",
              },
            ],
          },
        ],
        plugins: [],
      })

    await expect(
      composeVoyantGraphRuntime({ runtime: createRuntime(declaredPort), capabilities: {} }),
    ).rejects.toThrow(/requires runtime port "loyalty.runtime"/)
    await expect(
      composeVoyantGraphRuntime({
        runtime: createRuntime(undeclaredPort),
        capabilities: {},
        ports: { [undeclaredPort.id]: {} },
      }),
    ).rejects.toThrow(/requested undeclared port "billing.runtime"/)
  })

  it("allows factories to branch on optional runtime-port bindings", async () => {
    const optionalPort = definePort<{ name: string }>({
      id: "loyalty.optional-runtime",
      test: () => {},
    })
    const factory = defineGraphRuntimeFactory(async ({ getPort, hasPort }) => ({
      module: {
        name: hasPort(optionalPort) ? (await getPort(optionalPort)).name : "loyalty-fallback",
      },
    }))
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:optional-runtime-port",
      entries: { "@acme/loyalty": async () => ({ createLoyaltyModule: factory }) },
      modules: [
        {
          id: "@acme/loyalty",
          kind: "module",
          packageName: "@acme/loyalty",
          order: 0,
          runtimePorts: [optionalPort.id],
          requiredRuntimePorts: [],
          routes: [
            {
              route: {
                id: "@acme/loyalty#api",
                surface: "admin",
                runtime: { entry: "@acme/loyalty", export: "createLoyaltyModule" },
              },
              importEntry: "@acme/loyalty",
            },
          ],
        },
      ],
      plugins: [],
    })

    await expect(composeVoyantGraphRuntime({ runtime, capabilities: {} })).resolves.toMatchObject({
      modules: [{ module: { name: "loyalty-fallback" } }],
    })
    await expect(
      composeVoyantGraphRuntime({
        runtime,
        capabilities: {},
        ports: { [optionalPort.id]: { name: "loyalty-bound" } },
      }),
    ).resolves.toMatchObject({
      modules: [{ module: { name: "loyalty-bound" } }],
    })
  })

  it("reads optional many-valued runtime ports without collapsing contributors", async () => {
    const providerPort = definePort<{ name: string }>({
      id: "loyalty.providers",
      test: () => {},
    })
    const factory = defineGraphRuntimeFactory(async ({ getPorts }) => ({
      module: { name: (await getPorts(providerPort)).map(({ name }) => name).join(",") || "none" },
    }))
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:many-runtime-port",
      entries: { "@acme/loyalty": async () => ({ createLoyaltyModule: factory }) },
      modules: [
        {
          id: "@acme/loyalty",
          kind: "module",
          packageName: "@acme/loyalty",
          order: 0,
          runtimePorts: [providerPort.id],
          manyRuntimePorts: [providerPort.id],
          requiredRuntimePorts: [],
          routes: [
            {
              route: {
                id: "@acme/loyalty#api",
                surface: "admin",
                runtime: { entry: "@acme/loyalty", export: "createLoyaltyModule" },
              },
              importEntry: "@acme/loyalty",
            },
          ],
        },
      ],
      plugins: [],
    })

    await expect(composeVoyantGraphRuntime({ runtime, capabilities: {} })).resolves.toMatchObject({
      modules: [{ module: { name: "none" } }],
    })
    await expect(
      composeVoyantGraphRuntime({
        runtime,
        capabilities: {},
        ports: { [providerPort.id]: [{ name: "alpha" }, { name: "zeta" }] },
      }),
    ).resolves.toMatchObject({ modules: [{ module: { name: "alpha,zeta" } }] })
  })

  it("runs a port's conformance kit before exposing a deployment binding", async () => {
    const runtimePort = definePort<{ ready: boolean }>({
      id: "loyalty.runtime",
      test(provider) {
        if (!provider.ready) throw new Error("loyalty.runtime provider is not ready")
      },
    })
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:non-conforming-runtime-port",
      entries: {
        "@acme/loyalty": async () => ({
          createLoyaltyModule: defineGraphRuntimeFactory(async ({ getPort }) => {
            await getPort(runtimePort)
            return { module: { name: "loyalty" } }
          }),
        }),
      },
      modules: [
        {
          id: "@acme/loyalty",
          kind: "module",
          packageName: "@acme/loyalty",
          order: 0,
          runtimePorts: [runtimePort.id],
          routes: [
            {
              route: {
                id: "@acme/loyalty#api",
                surface: "admin",
                runtime: { entry: "@acme/loyalty", export: "createLoyaltyModule" },
              },
              importEntry: "@acme/loyalty",
            },
          ],
        },
      ],
      plugins: [],
    })

    await expect(
      composeVoyantGraphRuntime({
        runtime,
        capabilities: {},
        ports: { [runtimePort.id]: { ready: false } },
      }),
    ).rejects.toThrow("loyalty.runtime provider is not ready")
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

  it("accepts plugin-owned modules and rejects invalid plugin runtime exports", async () => {
    const moduleRuntime = createVoyantGraphRuntime({
      graphHash: "sha256:plugin-module",
      entries: { "@acme/billing": async () => ({ billing: { module: { name: "billing" } } }) },
      modules: [],
      plugins: [
        {
          id: "@acme/billing",
          kind: "plugin",
          packageName: "@acme/billing",
          order: 0,
          runtimeReferenceId: "@acme/billing#runtime",
          references: [
            {
              id: "@acme/billing#runtime",
              unitId: "@acme/billing",
              facet: "runtime",
              entityId: "@acme/billing",
              runtime: { entry: "@acme/billing", export: "billing" },
              importEntry: "@acme/billing",
            },
          ],
          routes: [],
        },
      ],
    })
    await expect(
      composeVoyantGraphRuntime({ runtime: moduleRuntime, capabilities: {} }),
    ).resolves.toMatchObject({ modules: [{ module: { name: "billing" } }] })

    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:test",
      entries: { "@acme/audit": async () => ({ audit: { wrong: true } }) },
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
      /plugin "@acme\/audit" must resolve to HonoModule or HonoExtension/,
    )
  })
})

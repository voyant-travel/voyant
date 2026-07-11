import { createEventBus } from "@voyant-travel/core"
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
        metadata: expect.objectContaining({ eventId: expect.stringMatching(/^evt_/) }),
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
        "@voyant-travel/commerce/promotions/workflow-bulk-reindex": importCommerce,
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

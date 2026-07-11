import { createContainer, createEventBus } from "@voyant-travel/core"
import { assertPortConforms } from "@voyant-travel/core/project"
import { describe, expect, it, vi } from "vitest"
import {
  ADMIN_INVALIDATION_PUBLICATION_RUNTIME_KEY,
  createRealtimeHonoModule,
  realtimeRuntimePort,
} from "../../src/index.js"
import { createLocalRealtimeProvider } from "../../src/providers/local.js"
import { realtimeVoyantModule } from "../../src/voyant.js"

describe("realtime deployment manifest", () => {
  it("owns both authenticated route surfaces", () => {
    expect(realtimeVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/realtime",
      packageName: "@voyant-travel/realtime",
      provides: {
        ports: [{ id: "realtime.transport" }, { id: "realtime.admin-invalidation-publication" }],
      },
      runtimePorts: [{ id: "realtime.runtime" }],
      api: [
        {
          id: "@voyant-travel/realtime#api.admin",
          surface: "admin",
          runtime: {
            entry: "@voyant-travel/realtime",
            export: "createRealtimeVoyantRuntime",
          },
        },
        {
          id: "@voyant-travel/realtime#api.public",
          surface: "public",
          runtime: {
            entry: "@voyant-travel/realtime",
            export: "createRealtimeVoyantRuntime",
          },
        },
      ],
      providers: [
        {
          id: "@voyant-travel/realtime#provider.local",
          runtime: {
            entry: "@voyant-travel/realtime/providers/local",
            export: "createLocalRealtimeProvider",
          },
        },
        {
          id: "@voyant-travel/realtime#provider.voyant-cloud",
          runtime: {
            entry: "@voyant-travel/realtime/providers/voyant-cloud",
            export: "createVoyantCloudRealtimeProvider",
          },
        },
      ],
    })
  })

  it("stages the publication capability without activating domain subscribers", () => {
    expect(realtimeVoyantModule.provides?.ports).toContainEqual({
      id: "realtime.admin-invalidation-publication",
    })
    expect(realtimeVoyantModule.subscribers).toBeUndefined()
  })

  it("ships a conformance kit for deployment realtime providers", async () => {
    await expect(
      assertPortConforms(realtimeRuntimePort, { resolveProviders: () => [] }),
    ).resolves.toBeUndefined()
    await expect(
      assertPortConforms(realtimeRuntimePort, { resolveProviders: true } as never),
    ).rejects.toThrow(/resolveProviders/)
  })

  it("keeps provider resolution injectable through the manifest runtime factory", async () => {
    const resolveProviders = vi.fn(() => [])
    const module = createRealtimeHonoModule({ resolveProviders, bridgeRoutes: {} })

    await module.module.bootstrap?.({
      bindings: { REALTIME_API_KEY: "test" },
      container: createContainer(),
      eventBus: createEventBus(),
    })

    expect(resolveProviders).toHaveBeenCalledWith({ REALTIME_API_KEY: "test" })
  })

  it("binds admin invalidation publication without activating bridge routes", async () => {
    const container = createContainer()
    const module = createRealtimeHonoModule({
      resolveProviders: () => [createLocalRealtimeProvider()],
    })

    await module.module.bootstrap?.({
      bindings: {},
      container,
      eventBus: createEventBus(),
    })

    expect(container.has(ADMIN_INVALIDATION_PUBLICATION_RUNTIME_KEY)).toBe(true)
  })
})

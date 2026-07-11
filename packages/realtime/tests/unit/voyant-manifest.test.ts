import { createContainer, createEventBus } from "@voyant-travel/core"
import { assertPortConforms } from "@voyant-travel/core/project"
import { describe, expect, it, vi } from "vitest"
import { createRealtimeHonoModule, realtimeRuntimePort } from "../../src/index.js"
import { realtimeVoyantModule } from "../../src/voyant.js"

describe("realtime deployment manifest", () => {
  it("owns both authenticated route surfaces", () => {
    expect(realtimeVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/realtime",
      packageName: "@voyant-travel/realtime",
      provides: { ports: [{ id: "realtime.transport" }] },
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
})

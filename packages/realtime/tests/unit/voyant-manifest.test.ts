import { createContainer, createEventBus } from "@voyant-travel/core"
import { describe, expect, it, vi } from "vitest"
import { createRealtimeHonoModule } from "../../src/index.js"
import { realtimeVoyantModule } from "../../src/voyant.js"

describe("realtime deployment manifest", () => {
  it("owns both authenticated route surfaces", () => {
    expect(realtimeVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/realtime",
      packageName: "@voyant-travel/realtime",
      api: [
        {
          id: "@voyant-travel/realtime#api.admin",
          surface: "admin",
          runtime: {
            entry: "@voyant-travel/realtime",
            export: "createRealtimeHonoModule",
          },
        },
        {
          id: "@voyant-travel/realtime#api.public",
          surface: "public",
          runtime: {
            entry: "@voyant-travel/realtime",
            export: "createRealtimeHonoModule",
          },
        },
      ],
    })
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

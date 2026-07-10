import { describe, expect, it } from "vitest"
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
})

import { describe, expect, it } from "vitest"
import { operatorSettingsVoyantModule } from "../../src/voyant.js"

describe("operator-settings deployment manifest", () => {
  it("owns its absolute admin and public route surfaces", () => {
    expect(operatorSettingsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/operator-settings",
      packageName: "@voyant-travel/operator-settings",
      api: [
        {
          id: "@voyant-travel/operator-settings#api.admin",
          surface: "admin",
          mount: "settings",
        },
        {
          id: "@voyant-travel/operator-settings#api.public.operator-profile",
          surface: "public",
          mount: "operator-profile",
          anonymous: true,
        },
        {
          id: "@voyant-travel/operator-settings#api.public.settings",
          surface: "public",
          mount: "settings/operator",
          anonymous: true,
        },
      ],
      schema: [{ id: "@voyant-travel/operator-settings#schema" }],
      migrations: [{ id: "@voyant-travel/operator-settings#migrations" }],
      resources: [{ id: "@voyant-travel/operator-settings#resource.database", kind: "database" }],
      lifecycle: { uninstall: { default: "retain-data", purge: "not-supported" } },
    })
    expect(operatorSettingsVoyantModule.api?.every((route) => route.runtime)).toBe(true)
  })
})

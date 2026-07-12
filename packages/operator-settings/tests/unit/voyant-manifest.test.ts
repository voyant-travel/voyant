import type { OpenAPIHono } from "@hono/zod-openapi"
import { describe, expect, it } from "vitest"
import { createOperatorSettingsHonoModule } from "../../src/hono-module.js"
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
          openapi: { document: "operator-settings" },
        },
        {
          id: "@voyant-travel/operator-settings#api.public.operator-profile",
          surface: "public",
          mount: "operator-profile",
          anonymous: true,
          openapi: { document: "operator-settings" },
        },
        {
          id: "@voyant-travel/operator-settings#api.public.settings",
          surface: "public",
          mount: "settings/operator",
          anonymous: true,
          openapi: { document: "operator-settings" },
        },
      ],
      schema: [{ id: "@voyant-travel/operator-settings#schema" }],
      migrations: [{ id: "@voyant-travel/operator-settings#migrations" }],
      resources: [{ id: "@voyant-travel/operator-settings#resource.database", kind: "database" }],
      admin: {
        compositionOrder: 10,
        runtime: {
          entry: "@voyant-travel/operator-settings-react/settings",
          export: "createSelectedOperatorSettingsAdminExtension",
        },
        routes: [
          {
            id: "@voyant-travel/operator-settings#admin.route.operator-profile",
            path: "/settings/operator",
          },
        ],
      },
      lifecycle: { uninstall: { default: "retain-data", purge: "not-supported" } },
    })
    expect(operatorSettingsVoyantModule.api?.every((route) => route.runtime)).toBe(true)
  })

  it("marks each public OpenAPI operation with its graph API id", async () => {
    const routes = (await createOperatorSettingsHonoModule().lazyRoutes?.load()) as
      | OpenAPIHono
      | undefined
    const document = routes?.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "Operator Settings", version: "1" },
    })
    const paths = document?.paths

    expect(paths?.["/v1/public/operator-profile"]?.get?.["x-voyant-api-id"]).toBe(
      "@voyant-travel/operator-settings#api.public.operator-profile",
    )
    expect(paths?.["/v1/public/settings/operator"]?.get?.["x-voyant-api-id"]).toBe(
      "@voyant-travel/operator-settings#api.public.settings",
    )
  })
})

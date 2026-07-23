import { readFileSync } from "node:fs"
import { OpenAPIHono } from "@hono/zod-openapi"
import { describe, expect, it } from "vitest"

import { createOperatorWebhookAdminRoutes } from "../src/admin-routes.js"

const apiId = "@voyant-travel/webhook-delivery#api.admin"
const committed = JSON.parse(
  readFileSync(new URL("../openapi/admin/operator-webhooks.json", import.meta.url), "utf8"),
) as {
  openapi?: string
  info?: { title?: string; version?: string }
  paths: Record<string, Record<string, { "x-voyant-api-id"?: string }>>
}

describe("operator webhook OpenAPI ownership", () => {
  it("claims every committed and live operation", () => {
    const mounted = new OpenAPIHono()
    mounted.route(
      "/v1/admin/webhooks",
      createOperatorWebhookAdminRoutes({
        contracts: [],
      }),
    )
    const live = mounted.getOpenAPIDocument({
      openapi: "3.1.0",
      info: { title: "test", version: "1" },
    })

    expect(committed.openapi).toBe("3.1.0")
    expect(committed.info?.title).toBeTruthy()
    expect(committed.info?.version).toBeTruthy()
    expect(Object.keys(live.paths ?? {}).sort()).toEqual(Object.keys(committed.paths).sort())
    for (const path of Object.keys(committed.paths)) {
      expect(Object.keys(live.paths?.[path] ?? {}).sort()).toEqual(
        Object.keys(committed.paths[path] ?? {}).sort(),
      )
      for (const [method, operation] of Object.entries(committed.paths[path] ?? {})) {
        expect(operation["x-voyant-api-id"]).toBe(apiId)
        expect(
          (live.paths?.[path] as Record<string, { "x-voyant-api-id"?: string }> | undefined)?.[
            method
          ]?.["x-voyant-api-id"],
        ).toBe(apiId)
      }
    }
  })
})

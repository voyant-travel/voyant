import { readFileSync } from "node:fs"
import { OpenAPIHono } from "@hono/zod-openapi"
import { createApp } from "@voyant-travel/hono"
import { describe, expect, it } from "vitest"

import { createOperatorWebhookAdminRoutes } from "../src/admin-routes.js"
import { createOperatorWebhookVoyantRuntime } from "../src/api-runtime.js"
import operatorWebhooksVoyantModule from "../src/voyant.js"

const apiId = "@voyant-travel/webhook-delivery#api.admin"
const committed = JSON.parse(
  readFileSync(new URL("../openapi/admin/operator-webhooks.json", import.meta.url), "utf8"),
) as {
  openapi?: string
  info?: { title?: string; version?: string }
  paths: Record<string, Record<string, { "x-voyant-api-id"?: string }>>
}

describe("operator webhook OpenAPI ownership", () => {
  it("keeps the runtime mount aligned with the manifest and published contract", async () => {
    const runtime = await createOperatorWebhookVoyantRuntime({
      graph: {
        eventCatalog: { events: [] },
      },
    } as never)
    const manifestMount = operatorWebhooksVoyantModule.api?.[0]?.mount

    expect(manifestMount).toBe("webhooks")
    expect(runtime.module.name).toBe(manifestMount)
    expect(Object.keys(committed.paths)).toEqual(
      expect.arrayContaining(["/v1/admin/webhooks/events", "/v1/admin/webhooks/subscriptions"]),
    )

    const app = createApp<Record<string, never>, Record<string, never>>({
      manifest: { modules: ["@voyant-travel/webhook-delivery"] },
      registry: {
        modules: {
          "@voyant-travel/webhook-delivery": () => runtime,
        },
      },
      capabilities: {},
      db: () => ({}) as never,
      auth: {
        resolve: () => ({
          userId: "user_1",
          actor: "staff",
          realm: "admin",
          scopes: ["webhooks:read"],
        }),
      },
    })

    const canonical = await app.request("/v1/admin/webhooks/events", {}, {} as never)
    const staleRuntimeMount = await app.request(
      "/v1/admin/operator-webhooks/events",
      {},
      {} as never,
    )

    expect(canonical.status).toBe(200)
    await expect(canonical.json()).resolves.toEqual({ data: [] })
    expect(staleRuntimeMount.status).toBe(404)
  })

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

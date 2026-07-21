import { handleApiError } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"
import { createAppsAppApiRoutes } from "./app-api-routes.js"
import type { AppsWebhookDeliveryRuntime } from "./runtime-port.js"
import { appGrants, appInstallations, appReleases } from "./schema.js"

function accessDb(capturedAudit: unknown[], activated = 1): PostgresJsDatabase {
  const db = Object.create(null) as PostgresJsDatabase
  Object.assign(db, {
    transaction: (callback: (tx: PostgresJsDatabase) => unknown) => callback(db),
    insert: () => ({
      values: async (value: unknown) => {
        capturedAudit.push(value)
      },
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () =>
            Array.from({ length: activated }, (_, index) => ({ id: `appws_${index + 1}` })),
        }),
      }),
    }),
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          const rows = () => {
            if (table === appInstallations) {
              return [
                {
                  id: "inst_1",
                  appId: "app_1",
                  deploymentId: "dep_1",
                  releaseId: "rel_1",
                  status: "active",
                  namespace: "app--one",
                },
              ]
            }
            if (table === appReleases) {
              return [
                {
                  id: "rel_1",
                  appId: "app_1",
                  releaseVersion: "1.0.0",
                  apiCompatibility: { min: "2026-07-01", max: "2026-12-31" },
                },
              ]
            }
            if (table === appGrants) return [{ scope: "app-webhooks:configure" }]
            return []
          }
          return {
            // biome-ignore lint/suspicious/noThenProperty: models Drizzle's awaitable query builder.
            then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows()).then(resolve),
            limit: async () => rows(),
          }
        },
      }),
    }),
  })
  return db
}

function mount(db: PostgresJsDatabase, webhookDelivery: AppsWebhookDeliveryRuntime) {
  const app = new Hono()
  app.onError((error, c) => handleApiError(error, c))
  app.use("*", async (c, next) => {
    c.set("db" as never, db as never)
    c.set("callerType" as never, "app" as never)
    c.set("appId" as never, "app_1" as never)
    c.set("appInstallationId" as never, "inst_1" as never)
    c.set("appReleaseId" as never, "rel_1" as never)
    c.set("appTokenMode" as never, "offline" as never)
    c.set("scopes" as never, ["app-webhooks:configure"] as never)
    await next()
  })
  app.route("/", createAppsAppApiRoutes({ webhookDelivery }))
  return app
}

function runtime(verified = true): AppsWebhookDeliveryRuntime {
  return {
    issueSigningKey: vi.fn(async () => ({
      id: "key_1",
      secret: "s".repeat(32),
      challenge: "signed-bounded-challenge",
    })),
    verifySigningKeyProof: vi.fn(async () => verified),
    resolveSigningKey: vi.fn(async () => ({ id: "key_1", secret: "s".repeat(32) })),
  }
}

describe("App API webhook signing-key provisioning", () => {
  it("issues host-owned key material with no-store and no persistence", async () => {
    const audit: unknown[] = []
    const response = await mount(accessDb(audit), runtime()).request(
      "/v1/app/webhooks/signing-key/issue",
      { method: "POST" },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({
      data: {
        keyId: "key_1",
        secret: "s".repeat(32),
        challenge: "signed-bounded-challenge",
      },
    })
    expect(audit).toEqual([])
  })

  it("confirms possession, activates subscriptions atomically, and audits no proof material", async () => {
    const audit: unknown[] = []
    const webhookDelivery = runtime()
    const response = await mount(accessDb(audit, 2), webhookDelivery).request(
      "/v1/app/webhooks/signing-key/confirm",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keyId: "key_1",
          challenge: "signed-bounded-challenge",
          proof: "proof".repeat(8),
        }),
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({
      data: { confirmed: true, activatedSubscriptions: 2 },
    })
    expect(webhookDelivery.verifySigningKeyProof).toHaveBeenCalledWith({
      appId: "app_1",
      installationId: "inst_1",
      keyId: "key_1",
      challenge: "signed-bounded-challenge",
      proof: "proof".repeat(8),
    })
    expect(JSON.stringify(audit)).not.toMatch(/signed-bounded-challenge|proofproof|ssssssss/)
    expect(audit).toEqual([
      expect.objectContaining({
        action: "webhooks.signing_key.confirmed",
        details: { activatedSubscriptions: 2 },
      }),
    ])
  })

  it("rejects invalid proof without activating or auditing", async () => {
    const audit: unknown[] = []
    const db = accessDb(audit)
    const update = vi.spyOn(db, "update")
    const response = await mount(db, runtime(false)).request(
      "/v1/app/webhooks/signing-key/confirm",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keyId: "key_1",
          challenge: "signed-bounded-challenge",
          proof: "proof".repeat(8),
        }),
      },
    )

    expect(response.status).toBe(400)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(update).not.toHaveBeenCalled()
    expect(audit).toEqual([])
  })
})

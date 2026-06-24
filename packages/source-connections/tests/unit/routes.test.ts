import { Hono } from "hono"
import { describe, expect, test } from "vitest"

import { sourceConnectionsAdminRoutes } from "../../src/routes.js"
import { createMemorySourceConnectionsDb } from "./fixtures.js"

describe("source connection admin routes", () => {
  test("creates, lists, retrieves, and transitions source connections", async () => {
    const app = makeApp()

    const createRes = await app.request("/v1/admin/source-connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceKind: "crm:hubspot",
        displayName: "HubSpot production",
        capabilityScope: "people",
        sourceOfTruthMode: "mirrored",
        credentialRef: "secret://source-connections/hubspot-prod",
        sourceAccountId: "portal-123",
        grantedScopes: ["crm.objects.contacts.read"],
        capabilities: [{ capability: "delta sync", state: "supported" }],
      }),
    })
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()) as {
      data: { id: string; status: string; createdAt: string; credentialRef: string }
    }
    expect(created.data).toMatchObject({
      status: "draft",
      credentialRef: "secret://source-connections/hubspot-prod",
    })
    expect(typeof created.data.createdAt).toBe("string")

    const listRes = await app.request("/v1/admin/source-connections")
    expect(listRes.status).toBe(200)
    const list = (await listRes.json()) as { total: number; data: Array<{ id: string }> }
    expect(list.total).toBe(1)
    expect(list.data[0]?.id).toBe(created.data.id)

    const detailRes = await app.request(`/v1/admin/source-connections/${created.data.id}`)
    expect(detailRes.status).toBe(200)

    const pauseRes = await app.request(`/v1/admin/source-connections/${created.data.id}/pause`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "maintenance" }),
    })
    expect(pauseRes.status).toBe(200)
    expect((await pauseRes.json()) as { data: { status: string } }).toMatchObject({
      data: { status: "paused" },
    })

    const resumeRes = await app.request(`/v1/admin/source-connections/${created.data.id}/resume`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    expect(resumeRes.status).toBe(200)
    expect((await resumeRes.json()) as { data: { status: string } }).toMatchObject({
      data: { status: "active" },
    })

    const disconnectRes = await app.request(
      `/v1/admin/source-connections/${created.data.id}/disconnect`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: "source removed",
          disconnectBehavior: ["stop future sync only"],
        }),
      },
    )
    expect(disconnectRes.status).toBe(200)
    expect((await disconnectRes.json()) as { data: { status: string } }).toMatchObject({
      data: { status: "disconnected" },
    })
  })

  test("returns structured validation errors for invalid route bodies", async () => {
    const app = makeApp()

    const res = await app.request("/v1/admin/source-connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceKind: "hubspot",
        displayName: "HubSpot production",
        capabilityScope: "people",
        sourceOfTruthMode: "mirrored",
      }),
    })

    expect(res.status).toBe(400)
    expect((await res.json()) as { code: string }).toMatchObject({
      code: "invalid_request",
    })
  })
})

function makeApp() {
  const app = new Hono()
  const db = createMemorySourceConnectionsDb()
  app.use("*", async (c, next) => {
    c.set("db" as never, db)
    await next()
  })
  return app.route("/v1/admin/source-connections", sourceConnectionsAdminRoutes)
}

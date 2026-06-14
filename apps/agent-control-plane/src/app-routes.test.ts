import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import { recommendations, tickSnapshot } from "./control-plane-test-fixtures.js"

describe("agent control plane routes", () => {
  it("serves health and dispatch planning through Hono", async () => {
    const app = createApp({ authTokens: ["secret"] })

    const health = await app.request("/health")
    expect(health.status).toBe(200)
    await expect(health.json()).resolves.toEqual({
      ok: true,
      service: "agent-control-plane",
    })

    const plan = await app.request("/api/dispatch-plans", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({
        recommendations,
        repository: "voyant-travel/voyant",
      }),
    })

    expect(plan.status).toBe(200)
    await expect(plan.json()).resolves.toMatchObject({
      reason: "matched",
      plan: {
        action: "start",
        issue: { number: 579 },
      },
    })
  })

  it("accepts tick snapshots through Hono", async () => {
    const app = createApp({ authTokens: ["secret"] })
    const response = await app.request("/api/tick-snapshots", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify(tickSnapshot),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      accepted: true,
      summary: {
        dispatchableRecommendationCount: 2,
        firstDispatchableAction: "remote-bootstrap",
        recentEventCount: 1,
        recommendationCount: 2,
      },
    })
    expect(body).toHaveProperty("snapshot.recommendations.0.issue.hasAgentBrief", true)
    expect(body).toHaveProperty("snapshot.recommendations.0.issue.labels", ["agent:ready", "ui"])
    expect(body).toHaveProperty("snapshot.recommendations.0.issue.state", "OPEN")
    expect(body).toHaveProperty("storage.persisted", false)
  })

  it("requires configured bearer auth for API routes", async () => {
    const missingConfig = createApp()
    const root = await missingConfig.request("/")
    expect(root.status).toBe(404)

    const notConfigured = await missingConfig.request("/api/capabilities")
    expect(notConfigured.status).toBe(503)
    await expect(notConfigured.json()).resolves.toEqual({
      error: "control_plane_auth_not_configured",
    })

    const app = createApp({ authTokens: ["secret"] })
    const unauthorized = await app.request("/api/capabilities")
    expect(unauthorized.status).toBe(401)
    await expect(unauthorized.json()).resolves.toEqual({ error: "unauthorized" })

    const authorized = await app.request("/api/capabilities", {
      headers: { authorization: "Bearer secret" },
    })
    expect(authorized.status).toBe(200)
    await expect(authorized.json()).resolves.toMatchObject({
      service: "agent-control-plane",
    })
  })

  it("returns validation errors for malformed planning requests", async () => {
    const app = createApp({ authTokens: ["secret"] })
    const planResponse = await app.request("/api/dispatch-plans", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({ recommendations: [] }),
    })

    expect(planResponse.status).toBe(400)
    await expect(planResponse.json()).resolves.toMatchObject({
      error: "invalid_dispatch_plan_request",
    })

    const snapshotResponse = await app.request("/api/tick-snapshots", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({ recommendations: [] }),
    })

    expect(snapshotResponse.status).toBe(400)
    await expect(snapshotResponse.json()).resolves.toMatchObject({
      error: "invalid_tick_snapshot_request",
    })
  })
})

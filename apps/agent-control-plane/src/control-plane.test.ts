import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import { buildCapabilities, selectDispatchPlan } from "./control-plane.js"

const recommendations = [
  {
    action: "run-command",
    reason: "implementation execution remains explicit",
    issue: {
      number: 581,
      title: "Run implementation command",
      url: "https://github.com/voyantjs/voyant/issues/581",
      repository: "voyantjs/voyant",
    },
  },
  {
    action: "start",
    reason: "maintainer-approved item is ready to claim",
    issue: {
      number: 579,
      title: "Test agent project intake workflow",
      url: "https://github.com/voyantjs/voyant/issues/579",
      repository: "voyantjs/voyant",
    },
  },
]

describe("agent control plane", () => {
  it("reports dry-run capabilities", () => {
    expect(buildCapabilities()).toMatchObject({
      service: "agent-control-plane",
      dryRunOnly: true,
      dispatchableActions: [
        "collect-ci",
        "cleanup",
        "open-pr",
        "publish-evidence",
        "start",
        "sync-pr",
      ],
    })
  })

  it("selects the first matching dispatchable plan", () => {
    expect(
      selectDispatchPlan({
        recommendations,
        repository: "voyantjs/voyant",
      }),
    ).toEqual({
      reason: "matched",
      plan: {
        action: "start",
        command: [
          "pnpm",
          "agent:queue:start",
          "--",
          "--issue",
          "579",
          "--repo",
          "voyantjs/voyant",
          "--yes",
        ],
        issue: recommendations[1]?.issue,
        reason: "maintainer-approved item is ready to claim",
        repository: "voyantjs/voyant",
        requiresMutation: true,
      },
    })
  })

  it("applies issue, action, and repository filters", () => {
    expect(
      selectDispatchPlan({
        filters: { action: "start", issueNumber: 579 },
        recommendations,
        repository: "VoyantJS/Voyant",
      }).plan?.issue.number,
    ).toBe(579)

    expect(
      selectDispatchPlan({
        filters: { action: "cleanup" },
        recommendations,
        repository: "voyantjs/voyant",
      }),
    ).toEqual({
      plan: null,
      reason: "no dispatchable recommendation matched",
    })

    expect(
      selectDispatchPlan({
        filters: { action: "run-command" },
        recommendations,
        repository: "voyantjs/voyant",
      }),
    ).toEqual({
      plan: null,
      reason: "action run-command is not dispatchable",
    })
  })

  it("selects CI evidence collection but not implementation execution", () => {
    const ciRecommendation = {
      action: "collect-ci",
      reason: "failing PR checks need a local CI repair packet",
      issue: {
        number: 626,
        title: "Repair failing checks",
        url: "https://github.com/voyantjs/voyant/issues/626",
        repository: "voyantjs/voyant",
      },
    }

    expect(
      selectDispatchPlan({
        recommendations: [ciRecommendation, recommendations[0]!],
        repository: "voyantjs/voyant",
      }).plan,
    ).toMatchObject({
      action: "collect-ci",
      command: [
        "pnpm",
        "agent:queue:collect-ci",
        "--",
        "--issue",
        "626",
        "--repo",
        "voyantjs/voyant",
        "--yes",
      ],
    })
  })

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
        repository: "voyantjs/voyant",
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
    const response = await app.request("/api/dispatch-plans", {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({ recommendations: [] }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_dispatch_plan_request",
    })
  })
})

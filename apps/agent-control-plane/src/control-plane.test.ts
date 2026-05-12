import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import {
  acceptTickSnapshot,
  buildCapabilities,
  selectDispatchPlan,
  tickSnapshotRequestSchema,
} from "./control-plane.js"

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

const tickSnapshot = {
  project: {
    owner: "voyantjs",
    number: 1,
    title: "Voyant Engineering",
    url: "https://github.com/orgs/voyantjs/projects/1",
  },
  repository: "voyantjs/voyant",
  maxAgeDays: 1,
  eventLog: {
    path: "/repo/.agent-runs/events.jsonl",
    recentEvents: [
      {
        timestamp: "2026-05-12T05:00:00.000Z",
        type: "dispatch.completed",
        issue: { number: 579 },
      },
    ],
  },
  recommendations: [
    {
      action: "remote-bootstrap",
      command: "pnpm agent:queue:remote-bootstrap -- --issue 579 --repo voyantjs/voyant --yes",
      issue: {
        number: 579,
        title: "Test agent project intake workflow",
        url: "https://github.com/voyantjs/voyant/issues/579",
        repository: "voyantjs/voyant",
        agentBrief: "Acceptance criteria and verification lane.",
        hasAgentBrief: true,
        labels: ["agent:ready", "ui"],
        state: "OPEN",
      },
      priority: 20,
      reason: "remote workspace is ready for repository bootstrap",
      state: "Ready",
    },
    {
      action: "remote-run-command",
      command:
        'pnpm agent:queue:remote-run-command -- --issue 580 --repo voyantjs/voyant --command "<implementation-command>" --yes',
      issue: {
        number: 580,
        title: "Run implementation",
        url: "https://github.com/voyantjs/voyant/issues/580",
        repository: "voyantjs/voyant",
      },
      priority: 30,
      reason: "implementation execution remains explicit",
      state: "Planning",
    },
  ],
}

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
        "remote-bootstrap",
        "remote-cleanup",
        "remote-open-pr",
        "remote-publish-evidence",
        "start",
        "sync-pr",
      ],
      snapshotContracts: {
        tick: {
          persistence: "none",
          version: 1,
        },
      },
    })
  })

  it("accepts and summarizes tick snapshots without dispatching work", () => {
    expect(acceptTickSnapshot(tickSnapshot)).toEqual({
      accepted: true,
      snapshot: tickSnapshot,
      summary: {
        dispatchableRecommendationCount: 1,
        firstDispatchableAction: "remote-bootstrap",
        firstDispatchableIssueNumber: 579,
        recentEventCount: 1,
        recommendationCount: 2,
      },
    })
  })

  it("preserves extra issue metadata when validating tick snapshots", () => {
    expect(tickSnapshotRequestSchema.parse(tickSnapshot).recommendations[0]?.issue).toMatchObject({
      agentBrief: "Acceptance criteria and verification lane.",
      hasAgentBrief: true,
      labels: ["agent:ready", "ui"],
      state: "OPEN",
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

  it("plans allow-listed remote lifecycle actions", () => {
    const remoteRecommendation = {
      action: "remote-publish-evidence",
      reason: "remote workspace evidence should be published before PR creation",
      issue: {
        number: 628,
        title: "Publish remote evidence",
        url: "https://github.com/voyantjs/voyant/issues/628",
        repository: "voyantjs/voyant",
      },
    }

    expect(
      selectDispatchPlan({
        recommendations: [remoteRecommendation],
        repository: "voyantjs/voyant",
      }).plan,
    ).toMatchObject({
      action: "remote-publish-evidence",
      command: [
        "pnpm",
        "agent:queue:remote-publish-evidence",
        "--",
        "--issue",
        "628",
        "--repo",
        "voyantjs/voyant",
        "--yes",
      ],
    })
  })

  it("adds event log context to planned lifecycle commands", () => {
    expect(
      selectDispatchPlan({
        options: { eventLog: ".agent-runs/supervisor.jsonl" },
        recommendations: [recommendations[1]!],
        repository: "voyantjs/voyant",
      }).plan?.command,
    ).toEqual([
      "pnpm",
      "agent:queue:start",
      "--",
      "--issue",
      "579",
      "--repo",
      "voyantjs/voyant",
      "--yes",
      "--event-log",
      ".agent-runs/supervisor.jsonl",
    ])
  })

  it("adds PR body refresh only for sync plans", () => {
    const syncRecommendation = {
      action: "sync-pr",
      reason: "linked PR should be synced back to the Project",
      issue: {
        number: 627,
        title: "Sync review state",
        url: "https://github.com/voyantjs/voyant/issues/627",
        repository: "voyantjs/voyant",
      },
    }

    expect(
      selectDispatchPlan({
        options: { eventLog: ".agent-runs/supervisor.jsonl", updateBody: true },
        recommendations: [syncRecommendation],
        repository: "voyantjs/voyant",
      }).plan?.command,
    ).toEqual([
      "pnpm",
      "agent:queue:sync-pr",
      "--",
      "--issue",
      "627",
      "--repo",
      "voyantjs/voyant",
      "--yes",
      "--event-log",
      ".agent-runs/supervisor.jsonl",
      "--update-body",
    ])

    expect(
      selectDispatchPlan({
        options: { updateBody: true },
        recommendations: [recommendations[1]!],
        repository: "voyantjs/voyant",
      }).plan?.command,
    ).not.toContain("--update-body")
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
        dispatchableRecommendationCount: 1,
        firstDispatchableAction: "remote-bootstrap",
        recentEventCount: 1,
        recommendationCount: 2,
      },
    })
    expect(body).toHaveProperty("snapshot.recommendations.0.issue.hasAgentBrief", true)
    expect(body).toHaveProperty("snapshot.recommendations.0.issue.labels", ["agent:ready", "ui"])
    expect(body).toHaveProperty("snapshot.recommendations.0.issue.state", "OPEN")
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

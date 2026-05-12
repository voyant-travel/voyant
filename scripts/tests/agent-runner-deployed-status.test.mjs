import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildDeployedStatusReport,
  dispatchPlanRequestForDeployedRunner,
  latestControlPlaneTickSnapshot,
  latestRunnerSupervisorTick,
  recentControlPlaneTickSnapshots,
  recentRunnerSupervisorTicks,
  summarizeActiveDispatchIntent,
  summarizeDispatchPlan,
} from "../lib/agent-runner-deployed-status.mjs"

describe("agent runner deployed status helpers", () => {
  it("builds a read-only deployed status report", async () => {
    const calls = []
    const report = await buildDeployedStatusReport({
      args: {
        controlPlaneUrl: "https://control.example.com/",
        runnerUrl: "https://runner.example.com/",
      },
      env: {
        AGENT_CONTROL_PLANE_TOKEN: "control-token",
        AGENT_RUNNER_TOKEN: "runner-token",
      },
      fetchImpl: async (url, init) => {
        calls.push({ init, url })
        return jsonResponse(responseForUrl(url))
      },
      activeDispatchRequest: {
        action: "remote-bootstrap",
        issueNumber: 579,
        repository: "voyantjs/voyant",
      },
      limit: 2,
      repository: "voyantjs/voyant",
    })

    assert.equal(report.ok, true)
    assert.equal(report.controlPlane.endpoint, "https://control.example.com")
    assert.equal(report.controlPlane.recentTickSnapshots.records.length, 1)
    assert.equal(report.controlPlane.dispatchPlan.plan.issue.number, 579)
    assert.equal(report.controlPlane.activeDispatch.intent.id, "intent_579")
    assert.equal(report.runner.endpoint, "https://runner.example.com")
    assert.equal(report.runner.supervisorStatus.repository, "voyantjs/voyant")
    assert.deepEqual(
      report.checks.map((check) => [check.name, check.ok]),
      [
        ["runner app configuration", true],
        ["runner app capabilities", true],
        ["runner app supervisor status", true],
        ["control plane configuration", true],
        ["control plane capabilities", true],
        ["control plane queue snapshots", true],
        ["control plane dispatch plan", true],
        ["control plane active dispatch", true],
      ],
    )
    assert.deepEqual(
      calls.map((call) => [call.url, call.init.headers.authorization]),
      [
        ["https://runner.example.com/api/capabilities", "Bearer runner-token"],
        [
          "https://runner.example.com/api/supervisor/status?repository=voyantjs%2Fvoyant&limit=2",
          "Bearer runner-token",
        ],
        ["https://control.example.com/api/capabilities", "Bearer control-token"],
        [
          "https://control.example.com/api/tick-snapshots/recent?repository=voyantjs%2Fvoyant&limit=2",
          "Bearer control-token",
        ],
        ["https://control.example.com/api/dispatch-plans/latest", "Bearer control-token"],
        [
          "https://control.example.com/api/dispatch-intents/active?action=remote-bootstrap&issueNumber=579&repository=voyantjs%2Fvoyant",
          "Bearer control-token",
        ],
      ],
    )
    assert.deepEqual(JSON.parse(calls[4].init.body), {
      filters: {
        action: "remote-bootstrap",
      },
      repository: "voyantjs/voyant",
    })
  })

  it("treats a missing dispatch snapshot as an empty plan", async () => {
    const report = await buildDeployedStatusReport({
      args: {
        controlPlaneUrl: "https://control.example.com/",
        runnerUrl: "https://runner.example.com/",
      },
      env: {
        AGENT_CONTROL_PLANE_TOKEN: "control-token",
        AGENT_RUNNER_TOKEN: "runner-token",
      },
      fetchImpl: async (url) => {
        if (url === "https://control.example.com/api/dispatch-plans/latest") {
          return jsonResponse({ error: "tick_snapshot_not_found" }, { status: 404 })
        }
        return jsonResponse(responseForUrl(url))
      },
      limit: 2,
      repository: "voyantjs/voyant",
    })

    assert.equal(report.ok, true)
    assert.deepEqual(summarizeDispatchPlan(report.controlPlane.dispatchPlan), {
      found: false,
      reason: "tick_snapshot_not_found",
      snapshotAcceptedAt: null,
    })
  })

  it("treats a missing active dispatch lookup as an empty status", async () => {
    const report = await buildDeployedStatusReport({
      args: {
        controlPlaneUrl: "https://control.example.com/",
        runnerUrl: "https://runner.example.com/",
      },
      env: {
        AGENT_CONTROL_PLANE_TOKEN: "control-token",
        AGENT_RUNNER_TOKEN: "runner-token",
      },
      fetchImpl: async (url) => {
        if (url.includes("/api/dispatch-intents/active")) {
          return jsonResponse({ error: "dispatch_intent_not_found" }, { status: 404 })
        }
        return jsonResponse(responseForUrl(url))
      },
      activeDispatchRequest: {
        action: "remote-bootstrap",
        issueNumber: 579,
        repository: "voyantjs/voyant",
      },
      limit: 2,
      repository: "voyantjs/voyant",
    })

    assert.equal(report.ok, true)
    assert.deepEqual(summarizeActiveDispatchIntent(report.controlPlane.activeDispatch), {
      active: false,
      found: false,
    })
  })

  it("reports missing configuration without calling deployed apps", async () => {
    const calls = []
    const report = await buildDeployedStatusReport({
      args: {},
      env: {},
      fetchImpl: async (url, init) => {
        calls.push({ init, url })
        return jsonResponse({})
      },
      repository: "voyantjs/voyant",
    })

    assert.equal(report.ok, false)
    assert.equal(calls.length, 0)
    assert.deepEqual(
      report.checks.map((check) => [check.name, check.ok]),
      [
        ["runner app configuration", false],
        ["control plane configuration", false],
      ],
    )
  })

  it("summarizes latest and recent control-plane snapshots", () => {
    const history = {
      records: [
        queueSnapshot({
          acceptedAt: "2026-05-12T12:00:00.000Z",
          dispatchableRecommendationCount: 1,
          firstDispatchableAction: "remote-bootstrap",
          firstDispatchableIssueNumber: 579,
          recommendationCount: 3,
        }),
      ],
    }

    const expected = {
      acceptedAt: "2026-05-12T12:00:00.000Z",
      dispatchableRecommendationCount: 1,
      firstDispatchableAction: "remote-bootstrap",
      firstDispatchableIssueNumber: 579,
      recommendationCount: 3,
    }

    assert.deepEqual(latestControlPlaneTickSnapshot(history), expected)
    assert.deepEqual(recentControlPlaneTickSnapshots(history), [expected])
  })

  it("summarizes dispatch plans", () => {
    assert.deepEqual(
      summarizeDispatchPlan({
        plan: dispatchPlan(),
        source: {
          acceptedAt: "2026-05-12T12:00:00.000Z",
        },
      }),
      {
        action: "remote-bootstrap",
        command: "pnpm agent:queue:remote-bootstrap",
        found: true,
        issueNumber: 579,
        issueTitle: "Bootstrap remote workspace",
        reason: "ready",
        snapshotAcceptedAt: "2026-05-12T12:00:00.000Z",
      },
    )

    assert.deepEqual(summarizeDispatchPlan({ plan: null, reason: "queue_empty" }), {
      found: false,
      reason: "queue_empty",
      snapshotAcceptedAt: null,
    })
  })

  it("builds dispatch plan requests from deployed runner defaults", () => {
    assert.deepEqual(
      dispatchPlanRequestForDeployedRunner({
        repository: "voyantjs/voyant",
        runnerCapabilities: {
          defaults: {
            action: "sync-pr",
          },
        },
      }),
      {
        filters: {
          action: "sync-pr",
        },
        repository: "voyantjs/voyant",
      },
    )

    assert.deepEqual(
      dispatchPlanRequestForDeployedRunner({
        repository: "voyantjs/voyant",
        runnerCapabilities: {
          defaults: {
            action: null,
          },
        },
      }),
      {
        repository: "voyantjs/voyant",
      },
    )
  })

  it("summarizes latest and recent runner supervisor ticks", () => {
    const status = {
      supervisorTicks: {
        latest: runnerTick({
          id: "tick_latest",
          intentId: "intent_579",
          reason: "leased_dispatch_intent",
        }),
        recent: [
          runnerTick({
            id: "tick_recent",
            leased: false,
            reason: "no_dispatch_plan",
          }),
        ],
      },
    }

    assert.deepEqual(latestRunnerSupervisorTick(status), {
      id: "tick_latest",
      intentId: "intent_579",
      leased: true,
      reason: "leased_dispatch_intent",
      recordedAt: "2026-05-12T12:00:00.000Z",
    })
    assert.deepEqual(recentRunnerSupervisorTicks(status), [
      {
        id: "tick_recent",
        intentId: null,
        leased: false,
        reason: "no_dispatch_plan",
        recordedAt: "2026-05-12T12:00:00.000Z",
      },
    ])
  })
})

function responseForUrl(url) {
  if (url === "https://control.example.com/api/capabilities") {
    return {
      dispatchIntentContracts: {
        latestSnapshotLease: {
          activeRead: true,
          persistence: "leased",
        },
      },
      service: "agent-control-plane",
      snapshotContracts: {
        tick: {
          persistence: "latest",
        },
      },
    }
  }

  if (
    url ===
    "https://control.example.com/api/tick-snapshots/recent?repository=voyantjs%2Fvoyant&limit=2"
  ) {
    return {
      records: [
        queueSnapshot({
          dispatchableRecommendationCount: 1,
          firstDispatchableAction: "remote-bootstrap",
          firstDispatchableIssueNumber: 579,
          recommendationCount: 3,
        }),
      ],
      repository: "voyantjs/voyant",
    }
  }

  if (url === "https://control.example.com/api/dispatch-plans/latest") {
    return {
      plan: dispatchPlan(),
      reason: "selected",
      source: {
        acceptedAt: "2026-05-12T12:00:00.000Z",
      },
    }
  }

  if (
    url ===
    "https://control.example.com/api/dispatch-intents/active?action=remote-bootstrap&issueNumber=579&repository=voyantjs%2Fvoyant"
  ) {
    return {
      active: true,
      intent: dispatchIntent(),
    }
  }

  if (url === "https://runner.example.com/api/capabilities") {
    return {
      execution: {
        enabled: true,
        mode: "lease-only",
      },
      defaults: {
        action: "remote-bootstrap",
      },
      service: "agent-runner",
      supervisorTicks: {
        persistence: "latest",
      },
    }
  }

  if (
    url === "https://runner.example.com/api/supervisor/status?repository=voyantjs%2Fvoyant&limit=2"
  ) {
    return {
      capabilities: {
        execution: {
          enabled: true,
          mode: "lease-only",
        },
      },
      repository: "voyantjs/voyant",
      service: "agent-runner",
      supervisorTicks: {
        latest: runnerTick({ id: "tick_latest" }),
        recent: [runnerTick({ id: "tick_recent" })],
        storage: {
          configured: true,
          persistence: "latest",
        },
      },
    }
  }

  throw new Error(`unexpected URL: ${url}`)
}

function dispatchPlan() {
  return {
    action: "remote-bootstrap",
    command: ["pnpm", "agent:queue:remote-bootstrap"],
    issue: {
      number: 579,
      title: "Bootstrap remote workspace",
    },
    reason: "ready",
  }
}

function dispatchIntent() {
  return {
    id: "intent_579",
    lease: {
      expiresAt: "2026-05-12T12:15:00.000Z",
      holder: "runner:cloudflare",
    },
    plan: {
      action: "remote-bootstrap",
      issue: {
        number: 579,
      },
    },
    status: "leased",
  }
}

function queueSnapshot({
  acceptedAt = "2026-05-12T12:00:00.000Z",
  dispatchableRecommendationCount = 0,
  firstDispatchableAction,
  firstDispatchableIssueNumber,
  recommendationCount = 0,
} = {}) {
  return {
    acceptedAt,
    summary: {
      dispatchableRecommendationCount,
      firstDispatchableAction,
      firstDispatchableIssueNumber,
      recommendationCount,
    },
  }
}

function runnerTick({ id, intentId, leased = true, reason = "dry_run" } = {}) {
  return {
    id,
    recordedAt: "2026-05-12T12:00:00.000Z",
    result: {
      ...(intentId ? { intent: { id: intentId } } : {}),
      leased,
      reason,
    },
  }
}

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
  })
}

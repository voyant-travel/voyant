import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildDeployedStatusReport,
  latestRunnerSupervisorTick,
  recentRunnerSupervisorTicks,
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
      limit: 2,
      repository: "voyantjs/voyant",
    })

    assert.equal(report.ok, true)
    assert.equal(report.controlPlane.endpoint, "https://control.example.com")
    assert.equal(report.runner.endpoint, "https://runner.example.com")
    assert.equal(report.runner.supervisorStatus.repository, "voyantjs/voyant")
    assert.deepEqual(
      report.checks.map((check) => [check.name, check.ok]),
      [
        ["control plane configuration", true],
        ["control plane capabilities", true],
        ["runner app configuration", true],
        ["runner app capabilities", true],
        ["runner app supervisor status", true],
      ],
    )
    assert.deepEqual(
      calls.map((call) => [call.url, call.init.headers.authorization]),
      [
        ["https://control.example.com/api/capabilities", "Bearer control-token"],
        ["https://runner.example.com/api/capabilities", "Bearer runner-token"],
        [
          "https://runner.example.com/api/supervisor/status?repository=voyantjs%2Fvoyant&limit=2",
          "Bearer runner-token",
        ],
      ],
    )
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
        ["control plane configuration", false],
        ["runner app configuration", false],
      ],
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

  if (url === "https://runner.example.com/api/capabilities") {
    return {
      execution: {
        enabled: true,
        mode: "lease-only",
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

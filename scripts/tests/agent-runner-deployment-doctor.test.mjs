import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  requestRecentRunnerSupervisorLeases,
  requestRunnerAppCapabilities,
  requestRunnerAppSupervisorStatus,
  requestRunnerAppSupervisorTick,
  runnerAppConfigFromArgs,
  summarizeControlPlaneCapabilities,
  summarizeRunnerAppCapabilities,
  summarizeRunnerPolicy,
  summarizeRunnerSmokeTick,
  summarizeRunnerSupervisorStatus,
} from "../lib/agent-runner-deployment-doctor.mjs"

describe("agent runner deployment doctor helpers", () => {
  it("reads runner app URL and token from CLI/env without logging tokens", () => {
    assert.deepEqual(
      runnerAppConfigFromArgs(
        { runnerUrl: "https://runner.example.com/" },
        { AGENT_RUNNER_TOKEN: "tok" },
      ),
      {
        token: "tok",
        url: "https://runner.example.com",
      },
    )
  })

  it("requires runner app URL and token", () => {
    assert.throws(
      () => runnerAppConfigFromArgs({}, { AGENT_RUNNER_TOKEN: "tok" }),
      /missing runner URL/,
    )
    assert.throws(
      () => runnerAppConfigFromArgs({ runnerUrl: "https://runner.example.com" }, {}),
      /missing runner token/,
    )
  })

  it("reads runner app capabilities", async () => {
    const calls = []
    const response = await requestRunnerAppCapabilities({
      fetchImpl: async (url, init) => {
        calls.push({ init, url })
        return new Response(
          JSON.stringify({
            execution: {
              enabled: true,
              mode: "lease-only",
            },
            service: "agent-runner",
            supervisorTicks: {
              leaseBudgetHistory: true,
              persistence: "latest",
            },
          }),
          { status: 200 },
        )
      },
      token: "tok",
      url: "https://runner.example.com/",
    })

    assert.equal(response.service, "agent-runner")
    assert.equal(calls[0].url, "https://runner.example.com/api/capabilities")
    assert.equal(calls[0].init.method, "GET")
    assert.equal(calls[0].init.headers.authorization, "Bearer tok")
  })

  it("surfaces rejected runner app capability responses", async () => {
    await assert.rejects(
      requestRunnerAppCapabilities({
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
          }),
        token: "tok",
        url: "https://runner.example.com",
      }),
      /401: unauthorized/,
    )
  })

  it("runs deployed runner supervisor smoke ticks", async () => {
    const calls = []
    const response = await requestRunnerAppSupervisorTick({
      fetchImpl: async (url, init) => {
        calls.push({ init, url })
        return new Response(
          JSON.stringify({
            result: {
              controlPlane: {
                status: 200,
              },
              leased: false,
              reason: "dry_run",
            },
            storage: {
              persisted: true,
            },
          }),
          { status: 200 },
        )
      },
      request: {
        dryRun: true,
        repository: "voyantjs/voyant",
        validateControlPlane: true,
      },
      token: "tok",
      url: "https://runner.example.com/",
    })

    assert.equal(response.result.reason, "dry_run")
    assert.equal(calls[0].url, "https://runner.example.com/api/supervisor/ticks")
    assert.equal(calls[0].init.method, "POST")
    assert.equal(calls[0].init.headers.authorization, "Bearer tok")
    assert.equal(calls[0].init.headers["content-type"], "application/json")
    assert.equal(
      calls[0].init.body,
      JSON.stringify({
        dryRun: true,
        repository: "voyantjs/voyant",
        validateControlPlane: true,
      }),
    )
  })

  it("reads deployed runner supervisor status", async () => {
    const calls = []
    const response = await requestRunnerAppSupervisorStatus({
      fetchImpl: async (url, init) => {
        calls.push({ init, url })
        return new Response(
          JSON.stringify({
            capabilities: {
              execution: {
                enabled: true,
                mode: "lease-only",
              },
            },
            repository: "voyantjs/voyant",
            service: "agent-runner",
            supervisorTicks: {
              latest: {
                result: {
                  reason: "dry_run",
                },
              },
              recent: [{ result: { reason: "dry_run" } }],
              storage: {
                configured: true,
                persistence: "latest",
              },
            },
            supervisorLeases: {
              recent: [{ id: "lease_579", leasedAt: "2026-05-12T12:00:00.000Z" }],
              storage: {
                configured: true,
                persistence: "history",
              },
            },
          }),
          { status: 200 },
        )
      },
      limit: 5,
      repository: "voyantjs/voyant",
      token: "tok",
      url: "https://runner.example.com/",
    })

    assert.equal(response.service, "agent-runner")
    assert.equal(
      calls[0].url,
      "https://runner.example.com/api/supervisor/status?repository=voyantjs%2Fvoyant&limit=5",
    )
    assert.equal(calls[0].init.method, "GET")
    assert.equal(calls[0].init.headers.authorization, "Bearer tok")
  })

  it("reads recent deployed runner supervisor leases", async () => {
    const calls = []
    const response = await requestRecentRunnerSupervisorLeases({
      fetchImpl: async (url, init) => {
        calls.push({ init, url })
        return new Response(
          JSON.stringify({
            records: [
              {
                id: "lease_579",
                leasedAt: "2026-05-12T12:00:00.000Z",
              },
            ],
            repository: "voyantjs/voyant",
          }),
          { status: 200 },
        )
      },
      limit: 5,
      repository: "voyantjs/voyant",
      since: "2026-05-11T12:00:00.000Z",
      token: "tok",
      url: "https://runner.example.com/",
    })

    assert.equal(response.records[0].id, "lease_579")
    assert.equal(
      calls[0].url,
      "https://runner.example.com/api/supervisor/leases/recent?repository=voyantjs%2Fvoyant&limit=5&since=2026-05-11T12%3A00%3A00.000Z",
    )
    assert.equal(calls[0].init.method, "GET")
    assert.equal(calls[0].init.headers.authorization, "Bearer tok")
  })

  it("surfaces rejected deployed runner supervisor smoke ticks", async () => {
    await assert.rejects(
      requestRunnerAppSupervisorTick({
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: "invalid_supervisor_tick_request" }), {
            status: 400,
          }),
        request: {},
        token: "tok",
        url: "https://runner.example.com",
      }),
      /400: invalid_supervisor_tick_request/,
    )
  })

  it("summarizes deployed capabilities without including secrets", () => {
    assert.deepEqual(
      summarizeControlPlaneCapabilities({
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
      }),
      {
        detail: "tick snapshots: latest; dispatch intents: leased; active read: true",
        ok: true,
      },
    )

    assert.deepEqual(
      summarizeRunnerAppCapabilities({
        defaults: {
          action: null,
        },
        execution: {
          enabled: false,
          mode: "disabled",
        },
        policy: {
          allowedActions: ["cleanup", "sync-pr"],
          requiresActionFilter: true,
        },
        coordinator: {
          mode: "durable-object",
        },
        runLedger: {
          persistence: "d1",
        },
        supervisorTicks: {
          leaseBudgetHistory: true,
          persistence: "latest",
        },
      }),
      {
        detail:
          "execution: disabled; enabled: false; tick persistence: latest; lease history: true; run ledger: d1; coordinator: durable-object; allowed actions: 2; default action: none; daily lease budget: none; requires action filter: true; CI repair opt-in: off",
        ok: true,
      },
    )

    assert.deepEqual(
      summarizeRunnerSmokeTick({
        result: {
          controlPlane: {
            status: 200,
          },
          reason: "dry_run",
        },
        storage: {
          persisted: true,
        },
      }),
      {
        detail: "reason: dry_run; control plane status: 200; storage persisted: true",
        ok: true,
      },
    )

    assert.deepEqual(
      summarizeRunnerSupervisorStatus({
        capabilities: {
          execution: {
            enabled: true,
          },
        },
        repository: "voyantjs/voyant",
        runLedger: {
          status: {
            recentLeaseCount: 1,
            recentRunCount: 2,
          },
          storage: {
            persistence: "d1",
          },
        },
        service: "agent-runner",
        supervisorTicks: {
          latest: {
            result: {
              reason: "dry_run",
            },
          },
          recent: [{ result: { reason: "dry_run" } }],
          storage: {
            persistence: "latest",
          },
        },
        supervisorLeases: {
          recent: [{ id: "lease_579" }],
          storage: {
            persistence: "history",
          },
        },
      }),
      {
        detail:
          "repository: voyantjs/voyant; tick persistence: latest; lease persistence: history; run ledger: d1; ledger runs: 2; ledger leases: 1; latest: dry_run; recent: 1; recent leases: 1",
        ok: true,
      },
    )
  })

  it("fails control plane summaries until required stores are configured", () => {
    assert.deepEqual(
      summarizeControlPlaneCapabilities({
        dispatchIntentContracts: {
          latestSnapshotLease: {
            activeRead: false,
            persistence: "none",
          },
        },
        service: "agent-control-plane",
        snapshotContracts: {
          tick: {
            persistence: "none",
          },
        },
      }),
      {
        detail: "tick snapshots: none; dispatch intents: none; active read: false",
        ok: false,
      },
    )

    assert.deepEqual(
      summarizeRunnerSmokeTick({
        result: {
          controlPlane: {
            status: 404,
          },
          reason: "control_plane_rejected",
        },
        storage: {
          persisted: true,
        },
      }),
      {
        detail:
          "reason: control_plane_rejected; control plane status: 404; storage persisted: true",
        ok: false,
      },
    )
  })

  it("summarizes deployed runner policy and CI repair opt-in", () => {
    assert.deepEqual(
      summarizeRunnerPolicy({
        defaults: {
          action: "remote-repair-ci",
        },
        policy: {
          allowedActions: ["remote-repair-ci", "sync-pr"],
          maxDailyLeases: 4,
          requiresActionFilter: true,
        },
      }),
      {
        allowedActionCount: 2,
        ciRepairAllowedActions: ["remote-repair-ci"],
        ciRepairEnabled: true,
        defaultAction: "remote-repair-ci",
        detail:
          "allowed actions: 2; default action: remote-repair-ci; daily lease budget: 4; requires action filter: true; CI repair opt-in: remote-repair-ci",
        maxDailyLeases: 4,
        ok: true,
        requiresActionFilter: true,
      },
    )

    assert.deepEqual(
      summarizeRunnerPolicy({
        defaults: {
          action: "repair-ci",
        },
        policy: {
          allowedActions: ["sync-pr"],
          requiresActionFilter: false,
        },
      }),
      {
        allowedActionCount: 1,
        ciRepairAllowedActions: [],
        ciRepairEnabled: false,
        defaultAction: "repair-ci",
        detail:
          "allowed actions: 1; default action: repair-ci; daily lease budget: none; requires action filter: false; CI repair opt-in: off; default action is not allowed",
        maxDailyLeases: null,
        ok: false,
        requiresActionFilter: false,
      },
    )

    assert.deepEqual(
      summarizeRunnerPolicy({
        defaults: {
          action: "syn-pr",
        },
        policy: {
          allowedActions: ["syn-pr"],
          requiresActionFilter: true,
        },
      }),
      {
        allowedActionCount: 1,
        ciRepairAllowedActions: [],
        ciRepairEnabled: false,
        defaultAction: "syn-pr",
        detail:
          "allowed actions: 1; default action: syn-pr; daily lease budget: none; requires action filter: true; CI repair opt-in: off; default action is not dispatchable",
        maxDailyLeases: null,
        ok: false,
        requiresActionFilter: true,
      },
    )
  })
})

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  requestRunnerAppCapabilities,
  runnerAppConfigFromArgs,
  summarizeControlPlaneCapabilities,
  summarizeRunnerAppCapabilities,
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
        execution: {
          enabled: false,
          mode: "disabled",
        },
        supervisorTicks: {
          persistence: "latest",
        },
      }),
      {
        detail: "execution: disabled; enabled: false; tick persistence: latest",
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
  })
})

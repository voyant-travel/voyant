import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { requestRecentTickSnapshots } from "../lib/agent-runner-control-plane.mjs"
import { requestRecentRunnerSupervisorTicks } from "../lib/agent-runner-deployment-doctor.mjs"

describe("agent runner history helpers", () => {
  it("reads recent tick snapshots", async () => {
    const calls = []
    const response = await requestRecentTickSnapshots({
      fetchImpl: async (url, init) => {
        calls.push({ init, url })
        return new Response(
          JSON.stringify({
            records: [
              {
                acceptedAt: "2026-05-12T12:00:00.000Z",
                snapshot: { repository: "voyantjs/voyant" },
                summary: { recommendationCount: 2 },
              },
            ],
            repository: "voyantjs/voyant",
          }),
          { status: 200 },
        )
      },
      limit: 5,
      repository: "voyantjs/voyant",
      token: "tok",
      url: "https://control.example.com/",
    })

    assert.equal(response.records.length, 1)
    assert.equal(
      calls[0].url,
      "https://control.example.com/api/tick-snapshots/recent?repository=voyantjs%2Fvoyant&limit=5",
    )
    assert.equal(calls[0].init.method, "GET")
    assert.equal(calls[0].init.headers.authorization, "Bearer tok")
  })

  it("surfaces rejected recent tick snapshot responses", async () => {
    await assert.rejects(
      requestRecentTickSnapshots({
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: "tick_snapshot_storage_not_configured" }), {
            status: 503,
          }),
        repository: "voyantjs/voyant",
        token: "tok",
        url: "https://control.example.com",
      }),
      /503: tick_snapshot_storage_not_configured/,
    )
  })

  it("reads recent runner supervisor ticks", async () => {
    const calls = []
    const response = await requestRecentRunnerSupervisorTicks({
      fetchImpl: async (url, init) => {
        calls.push({ init, url })
        return new Response(
          JSON.stringify({
            records: [
              {
                recordedAt: "2026-05-12T12:00:00.000Z",
                repository: "voyantjs/voyant",
                result: { leased: false, reason: "dry_run" },
              },
            ],
            repository: "voyantjs/voyant",
          }),
          { status: 200 },
        )
      },
      limit: 3,
      repository: "voyantjs/voyant",
      token: "tok",
      url: "https://runner.example.com/",
    })

    assert.equal(response.records.length, 1)
    assert.equal(
      calls[0].url,
      "https://runner.example.com/api/supervisor/ticks/recent?repository=voyantjs%2Fvoyant&limit=3",
    )
    assert.equal(calls[0].init.method, "GET")
    assert.equal(calls[0].init.headers.authorization, "Bearer tok")
  })

  it("surfaces rejected recent runner supervisor tick responses", async () => {
    await assert.rejects(
      requestRecentRunnerSupervisorTicks({
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: "supervisor_tick_storage_not_configured" }), {
            status: 503,
          }),
        repository: "voyantjs/voyant",
        token: "tok",
        url: "https://runner.example.com",
      }),
      /503: supervisor_tick_storage_not_configured/,
    )
  })
})

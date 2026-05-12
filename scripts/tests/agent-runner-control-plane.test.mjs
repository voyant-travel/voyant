import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  controlPlaneConfigFromArgs,
  requestLatestDispatchPlan,
  submitTickSnapshot,
} from "../lib/agent-runner-control-plane.mjs"

describe("agent runner control plane client", () => {
  it("reads URL and token from CLI/env without logging tokens", () => {
    assert.deepEqual(
      controlPlaneConfigFromArgs(
        { controlPlaneUrl: "https://control.example.com/" },
        { AGENT_CONTROL_PLANE_TOKEN: "tok" },
      ),
      {
        token: "tok",
        url: "https://control.example.com",
      },
    )
  })

  it("requires a control plane URL and env token", () => {
    assert.throws(
      () => controlPlaneConfigFromArgs({}, { AGENT_CONTROL_PLANE_TOKEN: "tok" }),
      /missing control plane URL/,
    )
    assert.throws(
      () => controlPlaneConfigFromArgs({ controlPlaneUrl: "https://control.example.com" }, {}),
      /missing control plane token/,
    )
  })

  it("posts tick snapshots to the non-mutating snapshot endpoint", async () => {
    const calls = []
    const response = await submitTickSnapshot({
      fetchImpl: async (url, init) => {
        calls.push({ init, url })
        return new Response(
          JSON.stringify({
            accepted: true,
            summary: {
              dispatchableRecommendationCount: 1,
              recommendationCount: 1,
            },
          }),
          { status: 200 },
        )
      },
      snapshot: { recommendations: [] },
      token: "tok",
      url: "https://control.example.com/",
    })

    assert.deepEqual(response.summary, {
      dispatchableRecommendationCount: 1,
      recommendationCount: 1,
    })
    assert.equal(calls[0].url, "https://control.example.com/api/tick-snapshots")
    assert.equal(calls[0].init.method, "POST")
    assert.equal(calls[0].init.headers.authorization, "Bearer tok")
    assert.equal(calls[0].init.headers["content-type"], "application/json")
    assert.equal(calls[0].init.body, JSON.stringify({ recommendations: [] }))
  })

  it("surfaces rejected snapshot responses", async () => {
    await assert.rejects(
      submitTickSnapshot({
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: "invalid_tick_snapshot_request" }), {
            status: 400,
          }),
        snapshot: {},
        token: "tok",
        url: "https://control.example.com",
      }),
      /400: invalid_tick_snapshot_request/,
    )
  })

  it("requests latest dispatch plans from stored snapshots", async () => {
    const calls = []
    const response = await requestLatestDispatchPlan({
      fetchImpl: async (url, init) => {
        calls.push({ init, url })
        return new Response(
          JSON.stringify({
            plan: {
              action: "remote-bootstrap",
              command: [
                "pnpm",
                "agent:queue:remote-bootstrap",
                "--",
                "--issue",
                "579",
                "--repo",
                "voyantjs/voyant",
                "--yes",
              ],
              issue: {
                number: 579,
                repository: "voyantjs/voyant",
                title: "Test issue",
                url: "https://github.com/voyantjs/voyant/issues/579",
              },
              reason: "ready",
              repository: "voyantjs/voyant",
              requiresMutation: true,
            },
            reason: "matched",
            source: {
              acceptedAt: "2026-05-12T12:00:00.000Z",
              recommendationCount: 1,
              repository: "voyantjs/voyant",
              type: "latest_tick_snapshot",
            },
          }),
          { status: 200 },
        )
      },
      request: {
        filters: {
          action: "remote-bootstrap",
          issueNumber: 579,
        },
        options: {
          eventLog: ".agent-runs/events.jsonl",
        },
        repository: "voyantjs/voyant",
      },
      token: "tok",
      url: "https://control.example.com/",
    })

    assert.equal(response.plan.action, "remote-bootstrap")
    assert.equal(response.source.type, "latest_tick_snapshot")
    assert.equal(calls[0].url, "https://control.example.com/api/dispatch-plans/latest")
    assert.equal(calls[0].init.method, "POST")
    assert.equal(calls[0].init.headers.authorization, "Bearer tok")
    assert.equal(calls[0].init.headers["content-type"], "application/json")
    assert.equal(
      calls[0].init.body,
      JSON.stringify({
        filters: {
          action: "remote-bootstrap",
          issueNumber: 579,
        },
        options: {
          eventLog: ".agent-runs/events.jsonl",
        },
        repository: "voyantjs/voyant",
      }),
    )
  })

  it("surfaces rejected latest dispatch plan responses", async () => {
    await assert.rejects(
      requestLatestDispatchPlan({
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: "latest_tick_snapshot_not_found" }), {
            status: 404,
          }),
        request: { repository: "voyantjs/voyant" },
        token: "tok",
        url: "https://control.example.com",
      }),
      /404: latest_tick_snapshot_not_found/,
    )
  })
})

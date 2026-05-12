import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  controlPlaneConfigFromArgs,
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
})

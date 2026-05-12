import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  normalizeRemoteHttpExposure,
  remoteBrowserArtifactPlan,
  waitForRemoteHttpReady,
} from "../lib/agent-runner-remote-browser.mjs"
import { parseWorkspaceReference } from "../lib/agent-runner-workspace-contract.mjs"
import { workItem } from "./agent-fixtures.mjs"

describe("agent runner remote browser helpers", () => {
  it("plans ignored local browser artifacts for a remote workspace", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const plan = remoteBrowserArtifactPlan({
      date: new Date("2026-05-11T12:34:56.000Z"),
      descriptor,
      item: workItem(),
      repoRoot: "/repo",
      workspaceReference: descriptor.reference,
    })

    assert.equal(plan.workspace, "/repo")
    assert.equal(
      plan.artifactPointer,
      ".agent-runs/remote-browser/579-test-agent-project-intake-workflow/2026-05-11T12-34-56-000Z",
    )
    assert.equal(
      plan.summaryJson,
      "/repo/.agent-runs/remote-browser/579-test-agent-project-intake-workflow/2026-05-11T12-34-56-000Z/summary.json",
    )
    assert.equal(plan.safeArtifactPath, true)
    assert.equal(plan.workspaceReference, "sandbox:sprite:task-579")
  })

  it("normalizes remote HTTP exposure adapter results", () => {
    assert.deepEqual(normalizeRemoteHttpExposure({ port: 3000, result: "https://preview.test" }), {
      port: 3000,
      url: "https://preview.test",
    })
    assert.deepEqual(
      normalizeRemoteHttpExposure({
        port: 3000,
        result: { tunnel: "abc", url: "https://preview.test" },
      }),
      {
        port: 3000,
        tunnel: "abc",
        url: "https://preview.test",
      },
    )
    assert.throws(
      () => normalizeRemoteHttpExposure({ port: 3000, result: { url: "ftp://preview.test" } }),
      /did not return a URL/,
    )
  })

  it("waits until the exposed remote HTTP URL is ready", async () => {
    let attempts = 0

    await waitForRemoteHttpReady("https://preview.test", {
      fetchImpl: async () => {
        attempts += 1
        return { status: attempts === 1 ? 503 : 200 }
      },
      intervalMs: 1,
      timeoutMs: 100,
    })

    assert.equal(attempts, 2)
  })

  it("fails when the exposed remote HTTP URL never becomes ready", async () => {
    await assert.rejects(
      waitForRemoteHttpReady("https://preview.test", {
        fetchImpl: async () => {
          throw new Error("connection refused")
        },
        intervalMs: 1,
        timeoutMs: 5,
      }),
      /timed out waiting for https:\/\/preview\.test: connection refused/,
    )
  })
})

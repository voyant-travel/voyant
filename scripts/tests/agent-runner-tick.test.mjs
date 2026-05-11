import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { recommendQueueAction, recommendQueueActions } from "../lib/agent-runner-tick.mjs"
import { workItem } from "./agent-fixtures.mjs"

describe("agent runner tick helpers", () => {
  it("recommends ordered queue tick actions", () => {
    const ready = workItem()
    const humanReview = workItem({
      fields: {
        "Agent State": "Human Review",
        Evidence: "docs/agent-evidence/active/579-test.md",
      },
      number: 580,
      title: "Publish evidence",
    })
    const staleRunning = workItem({
      fields: {
        "Agent State": "Running",
        "Last Heartbeat": "2026-05-08",
      },
      number: 581,
      title: "Inspect stale runner",
    })

    assert.deepEqual(
      recommendQueueActions([ready, humanReview, staleRunning], {
        maxAgeDays: 1,
        repository: "voyantjs/other",
      }).map((item) => item.action),
      ["inspect-stale", "start", "publish-evidence"],
    )
    assert.equal(
      recommendQueueActions([staleRunning], {
        maxAgeDays: 1,
        repository: "voyantjs/other",
      })[0].command,
      "pnpm agent:queue:watchdog -- --repo voyantjs/other",
    )
  })

  it("maps queue tick states to the next safe runner command", () => {
    assert.deepEqual(
      recommendQueueAction(workItem(), { maxAgeDays: 1, repository: "voyantjs/other" }),
      {
        action: "start",
        command: "pnpm agent:queue:start -- --issue 579 --repo voyantjs/other --yes",
        heartbeat: null,
        issue: workItem().issue,
        priority: 20,
        reason: "maintainer-approved item is ready to claim",
        state: null,
      },
    )

    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Human Review",
            Evidence: "https://github.com/voyantjs/voyant/issues/579#issuecomment-1",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ).action,
      "open-pr",
    )

    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Done",
            Workspace: ".agent-worktrees/579-test-agent-project-intake-workflow",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ).command,
      "pnpm agent:queue:cleanup -- --issue 579 --repo voyantjs/other --yes",
    )
  })

  it("recommends browser capture for active UI work before handoff", () => {
    const item = workItem({
      fields: {
        "Agent State": "Changes Requested",
        "Last Heartbeat": new Date().toISOString().slice(0, 10),
        Workspace: ".agent-worktrees/579-test-agent-project-intake-workflow",
      },
    })
    item.issue.labels = ["agent:ready", "ui-change"]

    const recommendation = recommendQueueAction(item, {
      maxAgeDays: 1,
      repository: "voyantjs/other",
    })
    assert.equal(recommendation.action, "capture-browser")
    assert.equal(
      recommendation.command,
      'pnpm agent:queue:capture-browser -- --issue 579 --repo voyantjs/other --dev-server-command "<dev-server-command>" --yes',
    )
    assert.equal(recommendation.heartbeat.stale, false)
    assert.equal(recommendation.priority, 35)
    assert.equal(recommendation.reason, "UI-labeled work needs browser evidence before handoff")

    const transcriptItem = workItem({
      fields: {
        "Agent State": "Running",
        Evidence: ".agent-runs/579-test/2026-05-10T12-34-56-000Z.log",
        "Last Heartbeat": new Date().toISOString().slice(0, 10),
        Workspace: ".agent-worktrees/579-test-agent-project-intake-workflow",
      },
    })
    transcriptItem.issue.labels = ["agent:ready", "ui-change"]

    assert.equal(
      recommendQueueAction(transcriptItem, { maxAgeDays: 1, repository: "voyantjs/other" }).action,
      "capture-browser",
    )

    const capturedItem = workItem({
      fields: {
        "Agent State": "Changes Requested",
        Evidence: "docs/agent-evidence/active/579-test.md",
        "Last Heartbeat": new Date().toISOString().slice(0, 10),
        Workspace: ".agent-worktrees/579-test-agent-project-intake-workflow",
      },
    })
    capturedItem.issue.labels = ["agent:ready", "ui-change"]

    assert.equal(
      recommendQueueAction(capturedItem, { maxAgeDays: 1, repository: "voyantjs/other" }).action,
      "run-command",
    )
  })
})

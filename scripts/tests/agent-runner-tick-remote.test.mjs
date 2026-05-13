import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { recommendQueueAction } from "../lib/agent-runner-tick.mjs"
import { workItem } from "./agent-fixtures.mjs"

describe("agent runner remote tick helpers", () => {
  it("recommends remote browser capture for remote UI work before handoff", () => {
    const item = workItem({
      fields: {
        "Agent State": "Human Review",
        "Last Heartbeat": new Date().toISOString().slice(0, 10),
        Workspace: "sandbox:sprite:task-579",
      },
    })
    item.issue.labels = ["agent:ready", "ui-change"]

    const recommendation = recommendQueueAction(item, {
      maxAgeDays: 1,
      repository: "voyantjs/other",
    })
    assert.equal(recommendation.action, "remote-capture-browser")
    assert.equal(
      recommendation.command,
      'pnpm agent:queue:remote-capture-browser -- --issue 579 --repo voyantjs/other --dev-server-command "<dev-server-command>" --port "<port>" --yes',
    )
    assert.equal(recommendation.heartbeat.stale, false)
    assert.equal(recommendation.priority, 54)
    assert.equal(
      recommendation.reason,
      "UI-labeled remote work in sandbox:sprite:task-579 needs browser evidence before handoff",
    )

    const prLinkedItem = workItem({
      fields: {
        "Agent State": "Human Review",
        "Last Heartbeat": new Date().toISOString().slice(0, 10),
        PR: "https://github.com/voyantjs/voyant/pull/626",
        Workspace: "sandbox:sprite:task-579",
      },
    })
    prLinkedItem.issue.labels = ["agent:ready", "ui-change"]

    assert.equal(
      recommendQueueAction(prLinkedItem, { maxAgeDays: 1, repository: "voyantjs/other" }).action,
      "remote-capture-browser",
    )

    const coveredItem = workItem({
      fields: {
        "Agent State": "Human Review",
        Evidence: "docs/agent-evidence/active/579-test.md",
        Workspace: "sandbox:sprite:task-579",
      },
    })
    coveredItem.issue.labels = ["agent:ready", "ui-change"]

    assert.equal(
      recommendQueueAction(coveredItem, { maxAgeDays: 1, repository: "voyantjs/other" }).action,
      "remote-publish-evidence",
    )
  })

  it("bootstraps ready remote workspace references before pausing local actions", () => {
    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Ready",
            Workspace: "sandbox:sprite:task-579",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ),
      {
        action: "remote-bootstrap",
        command: "pnpm agent:queue:remote-bootstrap -- --issue 579 --repo voyantjs/other --yes",
        heartbeat: null,
        issue: workItem().issue,
        priority: 20,
        reason: "remote workspace sandbox:sprite:task-579 is ready for repository bootstrap",
        state: "Ready",
      },
    )

    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Planning",
            "Last Heartbeat": new Date().toISOString().slice(0, 10),
            Workspace: "sandbox:sprite:task-579",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ),
      {
        action: "remote-run-command",
        command:
          'pnpm agent:queue:remote-run-command -- --issue 579 --repo voyantjs/other --command "<implementation-command>" --yes',
        heartbeat: {
          reason: "Last Heartbeat is 0 days old",
          stale: false,
        },
        issue: workItem().issue,
        priority: 30,
        reason:
          "remote workspace sandbox:sprite:task-579 is ready for supervised command execution",
        state: "Planning",
      },
    )

    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Human Review",
            Evidence: "docs/agent-evidence/active/579-test.md",
            Workspace: "sandbox:sprite:task-579",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ).action,
      "remote-publish-evidence",
    )

    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Human Review",
            Evidence: "https://artifacts.example.com/evidence.md",
            Workspace: "sandbox:sprite:task-579",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ).action,
      "remote-open-pr",
    )

    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Human Review",
            Evidence: "docs/agent-evidence/active/579-test.md",
            PR: "https://github.com/voyantjs/voyant/pull/626",
            Workspace: "sandbox:sprite:task-579",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ).action,
      "sync-pr",
    )

    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Done",
            Workspace: "sandbox:sprite:task-579",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ),
      {
        action: "remote-cleanup",
        command: "pnpm agent:queue:remote-cleanup -- --issue 579 --repo voyantjs/other --yes",
        heartbeat: null,
        issue: workItem().issue,
        priority: 90,
        reason: "remote workspace sandbox:sprite:task-579 needs remote adapter cleanup",
        state: "Done",
      },
    )
  })

  it("surfaces malformed sandbox workspace references before local actions", () => {
    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Planning",
            "Last Heartbeat": new Date().toISOString().slice(0, 10),
            Workspace: "sandbox:Sprite:task-579",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ),
      {
        action: "inspect-workspace",
        command: null,
        heartbeat: {
          reason: "Last Heartbeat is 0 days old",
          stale: false,
        },
        issue: workItem().issue,
        priority: 25,
        reason: "invalid Workspace: remote sandbox reference is malformed",
        state: "Planning",
      },
    )
  })
})

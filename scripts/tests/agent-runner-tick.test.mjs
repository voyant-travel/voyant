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
            "Agent State": "Merge Ready",
            PR: "https://github.com/voyantjs/voyant/pull/626",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ),
      {
        action: "sync-pr",
        command: "pnpm agent:queue:sync-pr -- --issue 579 --repo voyantjs/other --yes",
        heartbeat: null,
        issue: workItem().issue,
        priority: 50,
        reason: "merge-ready PR should be checked for maintainer merge",
        state: "Merge Ready",
      },
    )

    assert.equal(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "CI Repair",
            "Last Heartbeat": new Date().toISOString().slice(0, 10),
            PR: "https://github.com/voyantjs/voyant/pull/626",
            Workspace: "sandbox:sprite:task-579",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ).action,
      "collect-ci",
    )

    assert.equal(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "CI Repair",
            Evidence:
              ".agent-runs/579-test-agent-project-intake-workflow/ci-repair-2026-05-10T12-34-56-000Z.md",
            "Last Heartbeat": new Date().toISOString().slice(0, 10),
            PR: "https://github.com/voyantjs/voyant/pull/626",
            Workspace: "sandbox:sprite:task-579",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ).action,
      "remote-run-command",
    )

    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "CI Repair",
            "Last Heartbeat": new Date().toISOString().slice(0, 10),
            PR: "https://github.com/voyantjs/voyant/pull/626",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ),
      {
        action: "collect-ci",
        command: "pnpm agent:queue:collect-ci -- --issue 579 --repo voyantjs/other --yes",
        heartbeat: {
          reason: "Last Heartbeat is 0 days old",
          stale: false,
        },
        issue: workItem().issue,
        priority: 28,
        reason: "failing PR checks need a local CI repair packet",
        state: "CI Repair",
      },
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

    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "CI Repair",
            Evidence:
              ".agent-runs/579-test-agent-project-intake-workflow/ci-repair-2026-05-10T12-34-56-000Z.md",
            "Last Heartbeat": new Date().toISOString().slice(0, 10),
            PR: "https://github.com/voyantjs/voyant/pull/626",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ),
      {
        action: "run-command",
        command:
          'pnpm agent:queue:run-command -- --issue 579 --repo voyantjs/other --command "<ci-repair-command>" --yes',
        heartbeat: {
          reason: "Last Heartbeat is 0 days old",
          stale: false,
        },
        issue: workItem().issue,
        priority: 30,
        reason: "CI repair packet is ready for a narrow repair command",
        state: "CI Repair",
      },
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
      "wait-remote-pr",
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
        action: "wait-remote-cleanup",
        command: "pnpm agent:queue:remote-inspect -- --issue 579 --repo voyantjs/other",
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

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

  it("holds new implementation sessions while the local executor is at capacity", () => {
    const today = new Date().toISOString().slice(0, 10)
    const running = workItem({
      fields: {
        "Agent State": "Running",
        "Last Heartbeat": today,
      },
      number: 580,
      title: "Active implementation session",
    })
    const planning = workItem({
      fields: {
        "Agent State": "Planning",
        "Last Heartbeat": today,
      },
      number: 581,
      title: "Next implementation session",
    })

    assert.deepEqual(
      recommendQueueActions([running, planning], {
        implementationCommand: "codex exec fix",
        maxAgeDays: 1,
        repository: "voyantjs/other",
      }).map((item) => [item.issue.number, item.action, item.command, item.reason]),
      [
        [581, "wait-agent-session-capacity", null, "agent session capacity reached (1/1)"],
        [580, "wait-running", null, "command execution is already marked running"],
      ],
    )

    assert.equal(
      recommendQueueActions([running, planning], {
        implementationCommand: "codex exec fix",
        maxAgeDays: 1,
        maxAgentSessions: 2,
        repository: "voyantjs/other",
      })[0].action,
      "run-command",
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
        workspace: null,
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
        workspace: null,
      },
    )

    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Human Review",
            "Last Heartbeat": new Date().toISOString().slice(0, 10),
            PR: "https://github.com/voyantjs/voyant/pull/626",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ),
      {
        action: "wait-human-review",
        command: null,
        heartbeat: {
          reason: "Last Heartbeat is 0 days old",
          stale: false,
        },
        issue: workItem().issue,
        priority: 80,
        reason: "linked PR is awaiting human review",
        state: "Human Review",
        workspace: null,
      },
    )

    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Human Review",
            PR: "https://github.com/voyantjs/voyant/pull/626",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ),
      {
        action: "sync-pr",
        command: "pnpm agent:queue:sync-pr -- --issue 579 --repo voyantjs/other --yes",
        heartbeat: {
          reason: "Last Heartbeat is unset",
          stale: true,
        },
        issue: workItem().issue,
        priority: 50,
        reason: "stale linked PR should be synced back to the Project",
        state: "Human Review",
        workspace: null,
      },
    )

    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Changes Requested",
            "Last Heartbeat": new Date().toISOString().slice(0, 10),
            PR: "https://github.com/voyantjs/voyant/pull/626",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ),
      {
        action: "collect-review",
        command: "pnpm agent:queue:collect-review -- --issue 579 --repo voyantjs/other --yes",
        heartbeat: {
          reason: "Last Heartbeat is 0 days old",
          stale: false,
        },
        issue: workItem().issue,
        priority: 29,
        reason: "requested PR changes need a local review repair packet",
        state: "Changes Requested",
        workspace: null,
      },
    )

    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Changes Requested",
            Evidence:
              ".agent-runs/579-test-agent-project-intake-workflow/review-repair-2026-05-10T12-34-56-000Z.md",
            "Last Heartbeat": new Date().toISOString().slice(0, 10),
            PR: "https://github.com/voyantjs/voyant/pull/626",
          },
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ).action,
      "run-command",
    )

    assert.deepEqual(
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Human Review",
            "Last Heartbeat": new Date().toISOString().slice(0, 10),
            PR: "https://github.com/voyantjs/voyant/pull/626",
          },
          issueState: "CLOSED",
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ),
      {
        action: "complete-pr",
        command: "pnpm agent:queue:complete-pr -- --issue 579 --repo voyantjs/other --yes",
        heartbeat: {
          reason: "Last Heartbeat is 0 days old",
          stale: false,
        },
        issue: workItem({ issueState: "CLOSED" }).issue,
        priority: 45,
        reason: "closed issue with linked PR should be completed in the Project",
        state: "Human Review",
        workspace: null,
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
        workspace: null,
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
        workspace: null,
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
})

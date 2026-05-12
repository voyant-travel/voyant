import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  dispatchCommandArgs,
  dispatchIntentCommandArgs,
  runDispatchIntentCommand,
  selectDispatchRecommendation,
} from "../lib/agent-runner-dispatch.mjs"
import { recommendQueueAction } from "../lib/agent-runner-tick.mjs"
import { workItem } from "./agent-fixtures.mjs"

describe("agent runner dispatch helpers", () => {
  it("selects the highest-priority dispatchable recommendation", () => {
    const recommendations = [
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Running",
          },
          number: 581,
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ),
      recommendQueueAction(workItem({ number: 579 }), {
        maxAgeDays: 1,
        repository: "voyantjs/other",
      }),
      recommendQueueAction(
        workItem({
          fields: {
            "Agent State": "Human Review",
            Evidence: "docs/agent-evidence/active/580-test.md",
          },
          number: 580,
        }),
        { maxAgeDays: 1, repository: "voyantjs/other" },
      ),
    ]

    assert.equal(selectDispatchRecommendation(recommendations).recommendation.action, "start")
    assert.equal(
      selectDispatchRecommendation(recommendations, { issueNumber: 580 }).recommendation.action,
      "publish-evidence",
    )
  })

  it("builds pnpm command args with repository scope", () => {
    const recommendation = recommendQueueAction(workItem(), {
      maxAgeDays: 1,
      repository: "voyantjs/other",
    })

    assert.deepEqual(dispatchCommandArgs(recommendation, { repository: "voyantjs/other" }), [
      "agent:queue:start",
      "--",
      "--issue",
      "579",
      "--repo",
      "voyantjs/other",
      "--yes",
    ])
  })

  it("dispatches CI evidence collection before repair commands", () => {
    const recommendation = recommendQueueAction(
      workItem({
        fields: {
          "Agent State": "CI Repair",
          "Last Heartbeat": new Date().toISOString().slice(0, 10),
          PR: "https://github.com/voyantjs/voyant/pull/626",
        },
      }),
      { maxAgeDays: 1, repository: "voyantjs/other" },
    )

    assert.deepEqual(dispatchCommandArgs(recommendation, { repository: "voyantjs/other" }), [
      "agent:queue:collect-ci",
      "--",
      "--issue",
      "579",
      "--repo",
      "voyantjs/other",
      "--yes",
    ])
  })

  it("dispatches ready remote workspace bootstrap recommendations", () => {
    const recommendation = recommendQueueAction(
      workItem({
        fields: {
          "Agent State": "Ready",
          Workspace: "sandbox:sprite:task-579",
        },
      }),
      { maxAgeDays: 1, repository: "voyantjs/other" },
    )

    assert.equal(
      selectDispatchRecommendation([recommendation]).recommendation.action,
      "remote-bootstrap",
    )
    assert.deepEqual(dispatchCommandArgs(recommendation, { repository: "voyantjs/other" }), [
      "agent:queue:remote-bootstrap",
      "--",
      "--issue",
      "579",
      "--repo",
      "voyantjs/other",
      "--yes",
    ])
  })

  it("dispatches remote evidence publication recommendations", () => {
    const recommendation = recommendQueueAction(
      workItem({
        fields: {
          "Agent State": "Human Review",
          Evidence: "docs/agent-evidence/active/579-test.md",
          Workspace: "sandbox:sprite:task-579",
        },
      }),
      { maxAgeDays: 1, repository: "voyantjs/other" },
    )

    assert.equal(
      selectDispatchRecommendation([recommendation]).recommendation.action,
      "remote-publish-evidence",
    )
    assert.deepEqual(dispatchCommandArgs(recommendation, { repository: "voyantjs/other" }), [
      "agent:queue:remote-publish-evidence",
      "--",
      "--issue",
      "579",
      "--repo",
      "voyantjs/other",
      "--yes",
    ])
  })

  it("dispatches remote cleanup recommendations", () => {
    const recommendation = recommendQueueAction(
      workItem({
        fields: {
          "Agent State": "Done",
          Workspace: "sandbox:sprite:task-579",
        },
      }),
      { maxAgeDays: 1, repository: "voyantjs/other" },
    )

    assert.equal(
      selectDispatchRecommendation([recommendation]).recommendation.action,
      "remote-cleanup",
    )
    assert.deepEqual(dispatchCommandArgs(recommendation, { repository: "voyantjs/other" }), [
      "agent:queue:remote-cleanup",
      "--",
      "--issue",
      "579",
      "--repo",
      "voyantjs/other",
      "--yes",
    ])
  })

  it("dispatches remote PR publication recommendations", () => {
    const recommendation = recommendQueueAction(
      workItem({
        fields: {
          "Agent State": "Human Review",
          Evidence: "https://artifacts.example.com/evidence.md",
          Workspace: "sandbox:sprite:task-579",
        },
      }),
      { maxAgeDays: 1, repository: "voyantjs/other" },
    )

    assert.equal(
      selectDispatchRecommendation([recommendation]).recommendation.action,
      "remote-open-pr",
    )
    assert.deepEqual(dispatchCommandArgs(recommendation, { repository: "voyantjs/other" }), [
      "agent:queue:remote-open-pr",
      "--",
      "--issue",
      "579",
      "--repo",
      "voyantjs/other",
      "--yes",
    ])
  })

  it("passes custom event logs to nested dispatch commands", () => {
    const recommendation = recommendQueueAction(workItem(), {
      maxAgeDays: 1,
      repository: "voyantjs/other",
    })

    assert.deepEqual(
      dispatchCommandArgs(recommendation, {
        eventLog: ".agent-runs/supervisor.jsonl",
        repository: "voyantjs/other",
      }),
      [
        "agent:queue:start",
        "--",
        "--issue",
        "579",
        "--repo",
        "voyantjs/other",
        "--yes",
        "--event-log",
        ".agent-runs/supervisor.jsonl",
      ],
    )
  })

  it("passes PR body refresh only to sync recommendations", () => {
    const syncRecommendation = recommendQueueAction(
      workItem({
        fields: {
          "Agent State": "Human Review",
          PR: "https://github.com/voyantjs/voyant/pull/626",
        },
      }),
      { maxAgeDays: 1, repository: "voyantjs/other" },
    )

    assert.deepEqual(
      dispatchCommandArgs(syncRecommendation, {
        repository: "voyantjs/other",
        updateBody: true,
      }),
      [
        "agent:queue:sync-pr",
        "--",
        "--issue",
        "579",
        "--repo",
        "voyantjs/other",
        "--yes",
        "--update-body",
      ],
    )

    const startRecommendation = recommendQueueAction(workItem(), {
      maxAgeDays: 1,
      repository: "voyantjs/other",
    })

    assert.equal(
      dispatchCommandArgs(startRecommendation, {
        repository: "voyantjs/other",
        updateBody: true,
      }).includes("--update-body"),
      false,
    )
  })

  it("does not dispatch implementation or wait actions", () => {
    const running = recommendQueueAction(
      workItem({
        fields: {
          "Agent State": "Running",
        },
      }),
      { maxAgeDays: 1, repository: "voyantjs/other" },
    )

    assert.deepEqual(selectDispatchRecommendation([running]), {
      recommendation: null,
      reason: "no dispatchable recommendation matched",
    })

    const uiItem = workItem({
      fields: {
        "Agent State": "Changes Requested",
        "Last Heartbeat": new Date().toISOString().slice(0, 10),
        Workspace: ".agent-worktrees/579-test-agent-project-intake-workflow",
      },
    })
    uiItem.issue.labels = ["agent:ready", "ui-change"]

    assert.deepEqual(
      selectDispatchRecommendation([
        recommendQueueAction(uiItem, {
          maxAgeDays: 1,
          repository: "voyantjs/other",
        }),
      ]),
      {
        recommendation: null,
        reason: "no dispatchable recommendation matched",
      },
    )

    const remoteUiItem = workItem({
      fields: {
        "Agent State": "Human Review",
        "Last Heartbeat": new Date().toISOString().slice(0, 10),
        Workspace: "sandbox:sprite:task-579",
      },
    })
    remoteUiItem.issue.labels = ["agent:ready", "ui-change"]

    assert.deepEqual(
      selectDispatchRecommendation([
        recommendQueueAction(remoteUiItem, {
          maxAgeDays: 1,
          repository: "voyantjs/other",
        }),
      ]),
      {
        recommendation: null,
        reason: "no dispatchable recommendation matched",
      },
    )
  })

  it("rejects invalid issue filters before selecting a recommendation", () => {
    const recommendations = [
      recommendQueueAction(workItem(), {
        maxAgeDays: 1,
        repository: "voyantjs/other",
      }),
    ]

    assert.throws(
      () => selectDispatchRecommendation(recommendations, { issueNumber: "abc" }),
      /invalid issue number: abc/,
    )
    assert.throws(
      () => selectDispatchRecommendation(recommendations, { issueNumber: "0" }),
      /invalid issue number: 0/,
    )
  })

  it("validates and runs leased dispatch intent commands without a shell", () => {
    const intent = dispatchIntent()
    assert.deepEqual(dispatchIntentCommandArgs(intent), [
      "agent:queue:start",
      "--",
      "--issue",
      "579",
      "--repo",
      "voyantjs/voyant",
      "--yes",
    ])

    const calls = []
    const status = runDispatchIntentCommand(intent, {
      spawn: (binary, args, options) => {
        calls.push({ args, binary, options })
        return { status: 0 }
      },
    })

    assert.equal(status, 0)
    assert.deepEqual(calls, [
      {
        args: dispatchIntentCommandArgs(intent),
        binary: "pnpm",
        options: {
          encoding: "utf8",
          stdio: "inherit",
        },
      },
    ])
  })

  it("rejects leased dispatch intent commands outside the runner allow-list", () => {
    assert.throws(
      () =>
        dispatchIntentCommandArgs(
          dispatchIntent({
            command: ["node", "-e", "process.exit(0)"],
          }),
        ),
      /must use pnpm/,
    )
    assert.throws(
      () =>
        dispatchIntentCommandArgs(
          dispatchIntent({
            action: "start",
            command: ["pnpm", "agent:queue:cleanup", "--", "--issue", "579", "--yes"],
          }),
        ),
      /does not match start/,
    )
    assert.throws(
      () =>
        dispatchIntentCommandArgs(
          dispatchIntent({
            command: ["pnpm", "agent:queue:run-command", "--", "--issue", "579", "--yes"],
          }),
        ),
      /does not match start/,
    )
    assert.throws(
      () =>
        dispatchIntentCommandArgs(
          dispatchIntent({
            command: [
              "pnpm",
              "agent:queue:start",
              "--",
              "--issue",
              "579",
              "--repo",
              "voyantjs/voyant",
            ],
          }),
        ),
      /must include --yes/,
    )
    assert.throws(
      () =>
        dispatchIntentCommandArgs(
          dispatchIntent({
            command: [
              "pnpm",
              "agent:queue:start",
              "--",
              "--issue",
              "580",
              "--repo",
              "voyantjs/voyant",
              "--yes",
            ],
          }),
        ),
      /issue does not match/,
    )
    assert.throws(
      () =>
        dispatchIntentCommandArgs(
          dispatchIntent({
            command: [
              "pnpm",
              "agent:queue:start",
              "--",
              "--issue",
              "579",
              "--repo",
              "voyantjs/other",
              "--yes",
            ],
          }),
        ),
      /repository does not match/,
    )
  })
})

function dispatchIntent({ action = "start", command } = {}) {
  return {
    id: "intent_579",
    lease: {
      holder: "supervisor:test",
    },
    plan: {
      action,
      command: command ?? [
        "pnpm",
        "agent:queue:start",
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
    status: "leased",
  }
}

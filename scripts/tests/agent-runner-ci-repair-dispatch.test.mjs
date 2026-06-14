import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { dispatchCommandArgs, selectDispatchRecommendation } from "../lib/agent-runner-dispatch.mjs"
import { recommendQueueAction } from "../lib/agent-runner-tick.mjs"
import { workItem } from "./agent-fixtures.mjs"

const ciRepairEvidence =
  ".agent-runs/579-test-agent-project-intake-workflow/ci-repair-2026-05-10T12-34-56-000Z.md"

describe("agent runner CI repair dispatch", () => {
  it("recommends dispatchable local CI repair only when a repair command is configured", () => {
    const recommendation = recommendQueueAction(
      workItem({
        fields: {
          "Agent State": "CI Repair",
          Evidence: ciRepairEvidence,
          "Last Heartbeat": new Date().toISOString().slice(0, 10),
          PR: "https://github.com/voyant-travel/voyant/pull/626",
        },
      }),
      {
        ciRepairDispatchEnabled: true,
        maxAgeDays: 1,
        repository: "voyant-travel/other",
      },
    )

    assert.equal(selectDispatchRecommendation([recommendation]).recommendation.action, "repair-ci")
    assert.deepEqual(
      dispatchCommandArgs(recommendation, {
        ciRepairCommand: "pnpm verify:fast",
        repository: "voyant-travel/other",
      }),
      [
        "agent:queue:repair-ci",
        "--",
        "--issue",
        "579",
        "--repo",
        "voyant-travel/other",
        "--yes",
        "--ci-repair-command",
        "pnpm verify:fast",
      ],
    )
  })

  it("recommends dispatchable remote CI repair only when a repair command is configured", () => {
    const recommendation = recommendQueueAction(
      workItem({
        fields: {
          "Agent State": "CI Repair",
          Evidence: ciRepairEvidence,
          "Last Heartbeat": new Date().toISOString().slice(0, 10),
          PR: "https://github.com/voyant-travel/voyant/pull/626",
          Workspace: "sandbox:sprite:task-579",
        },
      }),
      {
        ciRepairDispatchEnabled: true,
        maxAgeDays: 1,
        repository: "voyant-travel/other",
      },
    )

    assert.deepEqual(dispatchCommandArgs(recommendation, { repository: "voyant-travel/other" }), [
      "agent:queue:remote-repair-ci",
      "--",
      "--issue",
      "579",
      "--repo",
      "voyant-travel/other",
      "--yes",
    ])
  })
})

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { dispatchCommandArgs, selectDispatchRecommendation } from "../lib/agent-runner-dispatch.mjs"
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
})

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { dispatchCommandArgs, selectDispatchRecommendation } from "../lib/agent-runner-dispatch.mjs"
import { recommendQueueAction } from "../lib/agent-runner-tick.mjs"
import { workItem } from "./agent-fixtures.mjs"

describe("agent runner dispatch completion helpers", () => {
  it("dispatches closed linked PR completion recommendations", () => {
    const recommendation = recommendQueueAction(
      workItem({
        fields: {
          "Agent State": "Human Review",
          PR: "https://github.com/voyant-travel/voyant/pull/626",
        },
        issueState: "CLOSED",
      }),
      { maxAgeDays: 1, repository: "voyant-travel/other" },
    )

    assert.equal(
      selectDispatchRecommendation([recommendation]).recommendation.action,
      "complete-pr",
    )
    assert.deepEqual(dispatchCommandArgs(recommendation, { repository: "voyant-travel/other" }), [
      "agent:queue:complete-pr",
      "--",
      "--issue",
      "579",
      "--repo",
      "voyant-travel/other",
      "--yes",
    ])
  })
})

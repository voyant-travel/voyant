import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { selectDispatchRecommendation } from "../lib/agent-runner-dispatch.mjs"
import { recommendQueueAction } from "../lib/agent-runner-tick.mjs"
import { workItem } from "./agent-fixtures.mjs"

describe("agent runner dispatch executor selection", () => {
  it("dispatches implementation work only after executor inputs are concrete", () => {
    const implementation = recommendQueueAction(
      workItem({
        fields: {
          "Agent State": "Planning",
          "Last Heartbeat": new Date().toISOString().slice(0, 10),
        },
      }),
      {
        implementationCommand: "pnpm verify:fast",
        maxAgeDays: 1,
        repository: "voyantjs/other",
      },
    )

    assert.equal(
      selectDispatchRecommendation([implementation]).recommendation.action,
      "run-command",
    )
    assert.equal(
      implementation.command,
      'pnpm agent:queue:run-command -- --issue 579 --repo voyantjs/other --command "pnpm verify:fast" --yes',
    )

    const remote = recommendQueueAction(
      workItem({
        fields: {
          "Agent State": "Planning",
          "Last Heartbeat": new Date().toISOString().slice(0, 10),
          Workspace: "sandbox:sprite:task-579",
        },
      }),
      {
        maxAgeDays: 1,
        remoteImplementationCommand: "pnpm verify:fast",
        repository: "voyantjs/other",
      },
    )

    assert.equal(selectDispatchRecommendation([remote]).recommendation.action, "remote-run-command")
  })
})

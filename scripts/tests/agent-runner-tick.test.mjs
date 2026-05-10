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
})

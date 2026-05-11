import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { remotePullRequestPlan, remotePushBranchShell } from "../lib/agent-runner-remote-pr.mjs"
import { parseWorkspaceReference } from "../lib/agent-runner-workspace-contract.mjs"
import { workItem } from "./agent-fixtures.mjs"

describe("agent runner remote PR helpers", () => {
  it("plans remote PR publication from the bootstrapped repository directory", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const plan = remotePullRequestPlan({
      descriptor,
      item: workItem({
        fields: {
          Branch: "task/579-test-agent-project-intake-workflow",
        },
      }),
    })

    assert.deepEqual(plan, {
      branch: "task/579-test-agent-project-intake-workflow",
      workspace: "/home/sprite/voyant-workspaces/task-579/repo",
    })
  })

  it("builds a guarded remote branch push shell", () => {
    const shell = remotePushBranchShell({
      branch: "task/579-test-agent-project-intake-workflow",
    })

    assert.match(shell, /git rev-parse --abbrev-ref HEAD/)
    assert.match(shell, /remote workspace has uncommitted changes/)
    assert.match(shell, /git push -u origin "\$branch"/)
  })

  it("can allow dirty remote workspaces when explicitly requested", () => {
    const shell = remotePushBranchShell({
      allowDirty: true,
      branch: "task/579-test-agent-project-intake-workflow",
    })

    assert.match(shell, /\[ 0 -eq 1 \]/)
  })
})

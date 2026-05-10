import assert from "node:assert/strict"
import path from "node:path"
import { describe, it } from "node:test"

import { claimFieldValues } from "../lib/agent-runner-claim.mjs"
import { buildExecutionPlan, workspacePlan } from "../lib/agent-runner-workspace.mjs"

describe("agent runner lifecycle helpers", () => {
  it("builds claim field values from the selected work item", () => {
    assert.deepEqual(claimFieldValues(workItem(), new Date("2026-05-10T12:34:56.000Z")), {
      Status: "In Progress",
      "Agent State": "Planning",
      Branch: "task/579-test-agent-project-intake-workflow",
      Workspace: ".agent-worktrees/579-test-agent-project-intake-workflow",
      "Last Heartbeat": "2026-05-10",
    })
  })

  it("resolves the local workspace and execution-plan path", () => {
    const plan = workspacePlan({
      baseRef: "origin/main",
      item: workItem(),
      repoRoot: "/repo",
    })

    assert.deepEqual(plan, {
      baseRef: "origin/main",
      branch: "task/579-test-agent-project-intake-workflow",
      workspace: path.resolve("/repo/.agent-worktrees/579-test-agent-project-intake-workflow"),
      planPath: path.resolve(
        "/repo/.agent-worktrees/579-test-agent-project-intake-workflow/docs/agent-plans/active/579-test-agent-project-intake-workflow.md",
      ),
    })
  })

  it("writes the durable execution-plan contract", () => {
    const item = workItem()
    const plan = buildExecutionPlan(item, {
      baseRef: "origin/main",
      workspace: "/repo/.agent-worktrees/579-test-agent-project-intake-workflow",
    })

    assert.match(plan, /^# Test agent project intake workflow/)
    assert.match(plan, /Issue: https:\/\/github\.com\/voyantjs\/voyant\/issues\/579/)
    assert.match(plan, /Branch: task\/579-test-agent-project-intake-workflow/)
    assert.match(plan, /- Project item: item-579/)
    assert.match(plan, /- Repository: voyantjs\/voyant/)
    assert.match(plan, /- Verification lane: verify:fast/)
    assert.match(plan, /## Milestones/)
    assert.match(plan, /## Risks And Rollback/)
  })
})

function workItem() {
  return {
    itemId: "item-579",
    issue: {
      number: 579,
      title: "Test agent project intake workflow",
      url: "https://github.com/voyantjs/voyant/issues/579",
      state: "OPEN",
      repository: "voyantjs/voyant",
      labels: ["agent:ready"],
    },
    dryRunPlan: {
      branch: "task/579-test-agent-project-intake-workflow",
      workspace: ".agent-worktrees/579-test-agent-project-intake-workflow",
      planPath: "docs/agent-plans/active/579-test-agent-project-intake-workflow.md",
      verificationLane: "verify:fast",
      risk: "Low",
      securityRisk: "None",
      agentProvider: "manual",
    },
  }
}

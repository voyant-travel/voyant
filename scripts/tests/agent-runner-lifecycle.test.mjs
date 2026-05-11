import assert from "node:assert/strict"
import path from "node:path"
import { describe, it } from "node:test"

import { claimFieldValues } from "../lib/agent-runner-claim.mjs"
import {
  buildCommandEvidencePacket,
  canRunCommandState,
  commandRunArtifactPlan,
  commandRunEnvironment,
  commandRunFieldUpdate,
} from "../lib/agent-runner-execution.mjs"
import {
  buildExecutionPlan,
  canCleanupAgentState,
  cleanupFieldValues,
  cleanupWorkspacePlan,
  removeWorkspace,
  workspacePlan,
} from "../lib/agent-runner-workspace.mjs"
import { workItem } from "./agent-fixtures.mjs"

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

  it("resolves cleanup workspaces under the agent worktree root", () => {
    const plan = cleanupWorkspacePlan({
      item: workItem(),
      repoRoot: "/repo",
    })

    assert.deepEqual(plan, {
      workspaceReference: ".agent-worktrees/579-test-agent-project-intake-workflow",
      workspace: path.resolve("/repo/.agent-worktrees/579-test-agent-project-intake-workflow"),
      agentWorktreeRoot: path.resolve("/repo/.agent-worktrees"),
      safeWorkspace: true,
    })
  })

  it("rejects cleanup workspaces outside the agent worktree root", () => {
    assert.equal(
      cleanupWorkspacePlan({
        item: workItem(),
        repoRoot: "/repo",
        workspaceReference: "../outside",
      }).safeWorkspace,
      false,
    )
  })

  it("only allows cleanup for terminal agent states unless forced", () => {
    assert.equal(canCleanupAgentState("Done"), true)
    assert.equal(canCleanupAgentState("Abandoned"), true)
    assert.equal(canCleanupAgentState("Human Review"), false)
    assert.equal(canCleanupAgentState("Human Review", { force: true }), true)
    assert.deepEqual(cleanupFieldValues(new Date("2026-05-10T12:34:56.000Z")), {
      "Last Heartbeat": "2026-05-10",
    })
  })

  it("treats a missing cleanup workspace as already removed when allowed", () => {
    assert.equal(
      removeWorkspace({ allowMissing: true, workspace: "/repo/.agent-worktrees/missing" }),
      false,
    )
  })

  it("plans command-run artifacts outside git and evidence inside the workspace", () => {
    const item = workItem()
    const plan = commandRunArtifactPlan({
      date: new Date("2026-05-10T12:34:56.000Z"),
      item,
      repoRoot: "/repo",
      workspaceReference: item.dryRunPlan.workspace,
    })
    assert.deepEqual(plan, {
      evidenceFile: path.resolve(
        "/repo/.agent-worktrees/579-test-agent-project-intake-workflow/docs/agent-evidence/active/579-test-agent-project-intake-workflow.md",
      ),
      evidencePointer: "docs/agent-evidence/active/579-test-agent-project-intake-workflow.md",
      logFile: path.resolve(
        "/repo/.agent-runs/579-test-agent-project-intake-workflow/2026-05-10T12-34-56-000Z.log",
      ),
      repoRoot: "/repo",
      safeEvidencePath: true,
      workspace: path.resolve("/repo/.agent-worktrees/579-test-agent-project-intake-workflow"),
      workspaceReference: ".agent-worktrees/579-test-agent-project-intake-workflow",
    })
  })

  it("rejects command-run evidence paths outside the workspace", () => {
    assert.equal(
      commandRunArtifactPlan({
        evidencePath: "../outside.md",
        item: workItem(),
        repoRoot: "/repo",
        workspaceReference: ".agent-worktrees/task",
      }).safeEvidencePath,
      false,
    )
  })

  it("builds command-run project updates and environment", () => {
    const item = workItem()
    const artifactPlan = commandRunArtifactPlan({
      item,
      repoRoot: "/repo",
      workspaceReference: item.dryRunPlan.workspace,
    })

    assert.equal(canRunCommandState("Planning"), true)
    assert.equal(canRunCommandState("Human Review"), false)
    assert.equal(canRunCommandState("Human Review", { force: true }), true)
    assert.deepEqual(
      commandRunFieldUpdate({
        date: new Date("2026-05-10T12:34:56.000Z"),
        evidencePointer: artifactPlan.evidencePointer,
        exitCode: 0,
      }),
      {
        clear: ["Blocked By"],
        values: {
          "Agent State": "Human Review",
          "Last Heartbeat": "2026-05-10",
          Evidence: "docs/agent-evidence/active/579-test-agent-project-intake-workflow.md",
        },
      },
    )
    assert.deepEqual(
      commandRunFieldUpdate({
        date: new Date("2026-05-10T12:34:56.000Z"),
        evidencePointer: artifactPlan.evidencePointer,
        exitCode: 2,
      }),
      {
        clear: [],
        values: {
          "Agent State": "Blocked",
          "Last Heartbeat": "2026-05-10",
          Evidence: "docs/agent-evidence/active/579-test-agent-project-intake-workflow.md",
          "Blocked By": "run-command exited with 2",
        },
      },
    )

    const env = commandRunEnvironment({
      artifactPlan,
      branch: item.dryRunPlan.branch,
      item,
      repository: "voyantjs/voyant",
    })
    assert.equal(env.VOYANT_AGENT_ISSUE, "579")
    assert.equal(env.VOYANT_AGENT_BRANCH, "task/579-test-agent-project-intake-workflow")
    assert.equal(env.VOYANT_AGENT_REPOSITORY, "voyantjs/voyant")
    assert.equal(env.VOYANT_AGENT_VERIFICATION_LANE, "verify:fast")
  })

  it("writes command-run evidence without provider attribution", () => {
    const item = workItem()
    const artifactPlan = commandRunArtifactPlan({
      item,
      repoRoot: "/repo",
      workspaceReference: item.dryRunPlan.workspace,
    })
    const evidence = buildCommandEvidencePacket({
      artifactPlan,
      branch: item.dryRunPlan.branch,
      command: "pnpm verify:fast",
      exitCode: 0,
      item,
      repository: "voyantjs/voyant",
      startedAt: new Date("2026-05-10T12:34:56.000Z"),
      stoppedAt: new Date("2026-05-10T12:35:56.000Z"),
    })

    assert.match(evidence, /Supervised command completed with exit code 0/)
    assert.match(evidence, /pnpm verify:fast/)
    assert.match(evidence, /Runner command transcript:/)
    assert.doesNotMatch(evidence, /codex|claude|generated by/i)
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
    assert.match(
      plan,
      /## Agent Brief\n\nCurrent behavior, desired behavior, acceptance criteria, and verification lane\./,
    )
    assert.match(plan, /## Milestones/)
    assert.match(plan, /## Risks And Rollback/)
  })

  it("refuses execution plans without an approved Agent Brief", () => {
    const item = workItem()
    const original = { error: console.error, exit: process.exit }
    delete item.issue.agentBrief

    try {
      console.error = () => {}
      process.exit = (code) => {
        throw new Error(`process exit ${code}`)
      }
      assert.throws(
        () => buildExecutionPlan(item, { baseRef: "origin/main", workspace: "/repo/worktree" }),
        /process exit 1/,
      )
    } finally {
      console.error = original.error
      process.exit = original.exit
    }
  })
})

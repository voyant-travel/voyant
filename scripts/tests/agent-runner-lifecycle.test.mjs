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
  evaluatePullRequestCompletion,
  evaluatePullRequestGate,
  isRemoteReference,
  pullRequestBody,
  pullRequestCompletionFieldValues,
  pullRequestCreateArgs,
  pullRequestFieldValues,
  pullRequestNumberFromUrl,
  pullRequestSyncFieldValues,
  pullRequestTitle,
  summarizeChecks,
} from "../lib/agent-runner-pr.mjs"
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

  it("builds PR metadata from issue and evidence context", () => {
    const item = workItem()
    item.issue.title = "[Task] Publish runner PR metadata"
    item.fields = {
      Branch: "task/579-test-agent-project-intake-workflow",
    }

    assert.equal(pullRequestTitle(item), "Publish runner PR metadata")
    assert.deepEqual(
      pullRequestFieldValues({
        date: new Date("2026-05-10T12:34:56.000Z"),
        prUrl: "https://github.com/voyantjs/voyant/pull/601",
      }),
      {
        PR: "https://github.com/voyantjs/voyant/pull/601",
        "Last Heartbeat": "2026-05-10",
      },
    )

    const body = pullRequestBody(item, {
      evidenceBody: "# Evidence\n\nAll checks passed.",
      evidenceReference: "docs/agent-evidence/active/579-test.md",
      repository: "voyantjs/voyant",
    })

    assert.match(body, /Implements #579/)
    assert.match(body, /<summary>docs\/agent-evidence\/active\/579-test.md<\/summary>/)
    assert.match(body, /All checks passed/)
    assert.match(body, /Verification lane: verify:fast/)
    assert.doesNotMatch(body, /codex|claude|generated by/i)
  })

  it("formats remote evidence as a link in PR bodies", () => {
    const body = pullRequestBody(workItem(), {
      evidenceBody: "",
      evidenceReference: "https://github.com/voyantjs/voyant/issues/579#issuecomment-1",
      repository: "voyantjs/voyant",
    })

    assert.equal(isRemoteReference("https://github.com/voyantjs/voyant/issues/579"), true)
    assert.equal(isRemoteReference("docs/agent-evidence/active/579-test.md"), false)
    assert.match(body, /- https:\/\/github\.com\/voyantjs\/voyant\/issues\/579#issuecomment-1/)
    assert.doesNotMatch(body, /<details>/)
  })

  it("opens same-repository PRs with an unqualified head branch", () => {
    const args = pullRequestCreateArgs({
      base: "main",
      body: "PR body",
      branch: "task/579-test-agent-project-intake-workflow",
      draft: true,
      title: "Test agent project intake workflow",
    })

    assert.deepEqual(args, [
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      "task/579-test-agent-project-intake-workflow",
      "--title",
      "Test agent project intake workflow",
      "--body",
      "PR body",
      "--draft",
    ])
    assert.equal(args.includes("voyantjs:task/579-test-agent-project-intake-workflow"), false)
  })

  it("parses PR numbers from GitHub pull request URLs", () => {
    assert.equal(pullRequestNumberFromUrl("https://github.com/voyantjs/voyant/pull/603"), 603)
    assert.equal(
      pullRequestNumberFromUrl("https://github.com/voyantjs/voyant/issues/603"),
      undefined,
    )
  })

  it("summarizes PR checks into successful, pending, and failed buckets", () => {
    assert.deepEqual(
      summarizeChecks([
        { name: "build", status: "COMPLETED", conclusion: "SUCCESS" },
        { name: "checks", status: "IN_PROGRESS", conclusion: "" },
        { name: "test", status: "COMPLETED", conclusion: "FAILURE" },
      ]),
      {
        failed: ["test"],
        pending: ["checks"],
        successful: ["build"],
      },
    )
  })

  it("moves failing PR checks to CI repair", () => {
    assert.deepEqual(
      evaluatePullRequestGate({
        state: "OPEN",
        isDraft: false,
        reviewDecision: "",
        statusCheckRollup: [{ name: "checks", status: "COMPLETED", conclusion: "FAILURE" }],
      }),
      {
        agentState: "CI Repair",
        blockedBy: "Failing checks: checks",
        mergeReady: false,
        reason: "checks failing",
      },
    )
  })

  it("moves requested changes to changes requested before check state", () => {
    assert.deepEqual(
      evaluatePullRequestGate({
        state: "OPEN",
        isDraft: false,
        reviewDecision: "CHANGES_REQUESTED",
        statusCheckRollup: [{ name: "checks", status: "COMPLETED", conclusion: "SUCCESS" }],
      }),
      {
        agentState: "Changes Requested",
        blockedBy: "PR changes requested",
        mergeReady: false,
        reason: "review changes requested",
      },
    )
  })

  it("keeps draft or pending-check PRs in human review", () => {
    assert.equal(
      evaluatePullRequestGate({
        state: "OPEN",
        isDraft: true,
        reviewDecision: "",
        statusCheckRollup: [{ name: "checks", status: "COMPLETED", conclusion: "SUCCESS" }],
      }).agentState,
      "Human Review",
    )

    assert.deepEqual(
      evaluatePullRequestGate({
        state: "OPEN",
        isDraft: false,
        reviewDecision: "",
        statusCheckRollup: [{ name: "checks", status: "QUEUED", conclusion: "" }],
      }),
      {
        agentState: "Human Review",
        blockedBy: "Pending checks: checks",
        mergeReady: false,
        reason: "checks pending",
      },
    )
  })

  it("keeps review-required PRs in human review even with passing checks", () => {
    assert.deepEqual(
      evaluatePullRequestGate({
        state: "OPEN",
        isDraft: false,
        reviewDecision: "REVIEW_REQUIRED",
        statusCheckRollup: [{ name: "checks", status: "COMPLETED", conclusion: "SUCCESS" }],
      }),
      {
        agentState: "Human Review",
        blockedBy: "PR review decision: REVIEW_REQUIRED",
        mergeReady: false,
        reason: "review required",
      },
    )
  })

  it("moves passing non-draft PRs to merge ready", () => {
    const pr = {
      url: "https://github.com/voyantjs/voyant/pull/603",
      state: "OPEN",
      isDraft: false,
      reviewDecision: "",
      statusCheckRollup: [{ name: "checks", status: "COMPLETED", conclusion: "SUCCESS" }],
    }
    const result = evaluatePullRequestGate(pr)

    assert.deepEqual(result, {
      agentState: "Merge Ready",
      blockedBy: null,
      mergeReady: true,
      reason: "PR is ready for maintainer merge",
    })
    assert.deepEqual(
      pullRequestSyncFieldValues({
        date: new Date("2026-05-10T12:34:56.000Z"),
        pr,
        result,
      }),
      {
        "Agent State": "Merge Ready",
        PR: "https://github.com/voyantjs/voyant/pull/603",
        "Last Heartbeat": "2026-05-10",
      },
    )
  })

  it("marks merged PRs complete", () => {
    const pr = {
      url: "https://github.com/voyantjs/voyant/pull/605",
      state: "MERGED",
    }
    const result = evaluatePullRequestCompletion(pr)

    assert.deepEqual(result, {
      complete: true,
      reason: "PR is merged",
    })
    assert.deepEqual(
      pullRequestCompletionFieldValues({
        date: new Date("2026-05-10T12:34:56.000Z"),
        pr,
      }),
      {
        Status: "Done",
        "Agent State": "Done",
        PR: "https://github.com/voyantjs/voyant/pull/605",
        "Last Heartbeat": "2026-05-10",
      },
    )
  })

  it("refuses to complete unmerged PRs", () => {
    assert.deepEqual(
      evaluatePullRequestCompletion({
        url: "https://github.com/voyantjs/voyant/pull/605",
        state: "OPEN",
      }),
      {
        complete: false,
        reason: "PR is OPEN",
      },
    )
  })
})

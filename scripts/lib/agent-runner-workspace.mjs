import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { fail, runGit } from "./agent-project-queue.mjs"

export function workspacePlan({ baseRef = "origin/main", item, repoRoot }) {
  const workspace = path.resolve(repoRoot, item.dryRunPlan.workspace)
  const planPath = path.join(workspace, item.dryRunPlan.planPath)

  return {
    baseRef,
    branch: item.dryRunPlan.branch,
    workspace,
    planPath,
  }
}

export function prepareWorkspace({ baseRef = "origin/main", item, repoRoot }) {
  const plan = workspacePlan({ baseRef, item, repoRoot })
  assertWorkspaceAvailable({ branch: plan.branch, repoRoot, workspace: plan.workspace })

  mkdirSync(path.dirname(plan.workspace), { recursive: true })
  runGit(["worktree", "add", "-b", plan.branch, plan.workspace, plan.baseRef], {
    cwd: repoRoot,
  })

  mkdirSync(path.dirname(plan.planPath), { recursive: true })
  writeFileSync(plan.planPath, buildExecutionPlan(item, plan), "utf8")

  return plan
}

export function assertWorkspaceAvailable({ branch, repoRoot, workspace }) {
  if (existsSync(workspace)) {
    fail(`workspace already exists: ${workspace}`)
  }

  if (branchExists(branch, repoRoot)) {
    fail(`branch already exists: ${branch}`)
  }
}

export function branchExists(branch, repoRoot) {
  const result = runGit(["branch", "--list", branch], { cwd: repoRoot })
  if (result) return true

  const remoteResult = runGit(["branch", "--remotes", "--list", `origin/${branch}`], {
    cwd: repoRoot,
  })
  return Boolean(remoteResult)
}

export function printWorkspacePlan({ item, plan, repository }) {
  console.log("agent-runner would create workspace:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`branch: ${plan.branch}`)
  console.log(`workspace: ${item.dryRunPlan.workspace}`)
  console.log(`plan: ${item.dryRunPlan.planPath}`)
  console.log(`verification: ${item.dryRunPlan.verificationLane}`)
}

export function buildExecutionPlan(item, { baseRef, workspace }) {
  const now = new Date().toISOString().replace("T", " ").slice(0, 16)
  const issue = item.issue
  const plan = item.dryRunPlan

  return `# ${issue.title}

Issue: ${issue.url}
Branch: ${plan.branch}
State: active

## Purpose

Prepare an implementation workspace for the maintainer-approved issue.

## Current State

- Project item: ${item.itemId}
- Repository: ${issue.repository}
- Base ref: ${baseRef}
- Local workspace: ${workspace}
- Risk: ${plan.risk}
- Security risk: ${plan.securityRisk}
- Verification lane: ${plan.verificationLane}

## Desired Behavior

The issue is implemented according to its acceptance criteria and handed off
with evidence.

## Scope

In scope:

- Read the issue, linked comments, relevant docs, and affected code.
- Update this plan with concrete milestones before implementation.
- Keep changes on branch \`${plan.branch}\`.

Out of scope:

- Running an implementation agent before the plan is reviewed.
- Pushing branches or opening PRs from this local prepare step.

## Milestones

- [ ] Expand current-state notes from issue context and codebase findings.
- [ ] Identify the narrow implementation path.
- [ ] Define focused verification commands.
- [ ] Implement and verify.
- [ ] Prepare evidence packet.

## Decisions

- ${now} UTC - Local workspace and execution plan prepared by the runner.

## Progress Log

- ${now} UTC - Created local worktree and plan file. No implementation agent
  has run.

## Verification Plan

- ${plan.verificationLane}

## Risks And Rollback

- Remove the local worktree with \`git worktree remove ${workspace}\` if this
  task is abandoned before implementation.
`
}

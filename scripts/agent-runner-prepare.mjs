import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import {
  currentRepositoryFromOrigin,
  fail,
  findSelectedReadyItem,
  loadAllEvaluatedProject,
  parseArgs,
  projectScanConfigFromArgs,
  runGit,
} from "./lib/agent-project-queue.mjs"
import {
  maybePrintHelp,
  mutationOptions,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:prepare",
  summary: "Create a local worktree and execution plan for one approved Project item.",
  usage: "pnpm agent:queue:prepare -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number to prepare. Required when multiple items are ready."],
    ["--base <ref>", "Base ref for the new worktree branch. Defaults to origin/main."],
    ...repositoryOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const item = findSelectedReadyItem(project.items, {
  issueNumber: args.issue,
  repository,
})

if (!args.yes) {
  printPlan(item)
  fail("prepare mode creates a local worktree and plan; rerun with --yes to continue")
}

const baseRef = args.base ?? "origin/main"
const workspace = path.resolve(repoRoot, item.dryRunPlan.workspace)
const planPath = path.join(workspace, item.dryRunPlan.planPath)
const planDirectory = path.dirname(planPath)

if (existsSync(workspace)) {
  fail(`workspace already exists: ${workspace}`)
}

if (branchExists(item.dryRunPlan.branch, repoRoot)) {
  fail(`branch already exists: ${item.dryRunPlan.branch}`)
}

mkdirSync(path.dirname(workspace), { recursive: true })
runGit(["worktree", "add", "-b", item.dryRunPlan.branch, workspace, baseRef], {
  cwd: repoRoot,
})

mkdirSync(planDirectory, { recursive: true })
writeFileSync(planPath, buildPlan(item, { baseRef, workspace }), "utf8")

console.log("agent-runner prepare: created local workspace")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`branch: ${item.dryRunPlan.branch}`)
console.log(`workspace: ${workspace}`)
console.log(`plan: ${planPath}`)
console.log("")
console.log("No agent was run. No GitHub state was changed.")

function branchExists(branch, repoRoot) {
  const result = runGit(["branch", "--list", branch], { cwd: repoRoot })
  if (result) return true

  const remoteResult = runGit(["branch", "--remotes", "--list", `origin/${branch}`], {
    cwd: repoRoot,
  })
  return Boolean(remoteResult)
}

function printPlan(selectedItem) {
  console.log("agent-runner prepare would create:")
  console.log(`issue: #${selectedItem.issue.number} ${selectedItem.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`branch: ${selectedItem.dryRunPlan.branch}`)
  console.log(`workspace: ${selectedItem.dryRunPlan.workspace}`)
  console.log(`plan: ${selectedItem.dryRunPlan.planPath}`)
  console.log(`verification: ${selectedItem.dryRunPlan.verificationLane}`)
}

function buildPlan(selectedItem, { baseRef, workspace }) {
  const now = new Date().toISOString().replace("T", " ").slice(0, 16)
  const issue = selectedItem.issue
  const plan = selectedItem.dryRunPlan

  return `# ${issue.title}

Issue: ${issue.url}
Branch: ${plan.branch}
State: active

## Purpose

Prepare an implementation workspace for the maintainer-approved issue.

## Current State

- Project item: ${selectedItem.itemId}
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
- Mutating GitHub Project state from this local prepare step.
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

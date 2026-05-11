import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { fail, runCommand, runGit } from "./agent-project-queue.mjs"
import { localWorkspaceReferencePlan } from "./agent-runner-workspace.mjs"

export const openPullRequestStates = new Set(["Human Review", "CI Repair", "Changes Requested"])
const successfulCheckConclusions = new Set(["SUCCESS", "SKIPPED", "NEUTRAL"])
const failedCheckConclusions = new Set([
  "ACTION_REQUIRED",
  "CANCELLED",
  "FAILURE",
  "STARTUP_FAILURE",
  "TIMED_OUT",
])

export function pullRequestFieldValues({ date = new Date(), prUrl }) {
  return {
    PR: prUrl,
    "Last Heartbeat": date.toISOString().slice(0, 10),
  }
}

export function pullRequestTitle(item) {
  return item.issue.title.replace(/^\[(Task|Bug|Refactor|Investigation|Cleanup)\]\s*:?\s*/i, "")
}

export function pullRequestBody(item, { evidenceBody, evidenceReference, repository }) {
  return `## Summary
- Implements #${item.issue.number}.
- See the evidence packet for the detailed change summary and verification notes.

## Evidence
${formatEvidence(evidenceReference, evidenceBody)}

## Review
- Repository: ${repository}
- Branch: ${item.fields.Branch ?? item.dryRunPlan.branch}
- Verification lane: ${item.dryRunPlan.verificationLane}
`
}

export function evidenceForPullRequest({ evidenceReference, repoRoot, workspaceReference }) {
  if (!evidenceReference) {
    fail("open-pr mode requires an Evidence field or --evidence <url-or-path>")
  }

  if (isRemoteReference(evidenceReference)) {
    return {
      evidenceBody: "",
      evidenceReference,
    }
  }

  const { workspace } = localWorkspaceReferencePlan({
    commandName: "open-pr mode",
    repoRoot,
    workspaceReference,
  })
  const evidencePath = path.resolve(workspace, evidenceReference)
  if (!existsSync(evidencePath)) {
    fail(`evidence packet does not exist: ${evidencePath}`)
  }

  const evidenceBody = readFileSync(evidencePath, "utf8")
  if (!evidenceBody.trim()) {
    fail(`evidence packet is empty: ${evidencePath}`)
  }

  return {
    evidenceBody,
    evidenceReference,
  }
}

export function assertWorkspaceReadyForPullRequest({ allowDirty = false, branch, workspace }) {
  const currentBranch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: workspace })
  if (currentBranch !== branch) {
    fail(`workspace branch is ${currentBranch}; expected ${branch}`)
  }

  const status = runGit(["status", "--porcelain"], { cwd: workspace })
  if (status && !allowDirty) {
    fail("workspace has uncommitted changes; commit them or pass --allow-dirty")
  }
}

export function pushBranch({ branch, workspace }) {
  runGit(["push", "-u", "origin", branch], { cwd: workspace })
}

export function existingPullRequestUrl({ branch, workspace }) {
  const result = runCommand("gh", ["pr", "view", branch, "--json", "url", "--jq", ".url"], {
    cwd: workspace,
    allowFailure: true,
  })
  return result || undefined
}

export function createPullRequest({ base, body, branch, draft = true, title, workspace }) {
  return runCommand("gh", pullRequestCreateArgs({ base, body, branch, draft, title }), {
    cwd: workspace,
  })
}

export function pullRequestCreateArgs({ base, body, branch, draft = true, title }) {
  const args = ["pr", "create", "--base", base, "--head", branch, "--title", title, "--body", body]
  if (draft) {
    args.push("--draft")
  }

  return args
}

export function updatePullRequestBody({ body, prReference, repository, workspace }) {
  runCommand("gh", pullRequestEditBodyArgs({ body, prReference, repository }), {
    cwd: workspace,
  })
}

export function pullRequestEditBodyArgs({ body, prReference, repository }) {
  return ["pr", "edit", String(prReference), "--repo", repository, "--body", body]
}

export function isRemoteReference(reference) {
  return /^https?:\/\//.test(reference)
}

export function pullRequestNumberFromUrl(prUrl) {
  const match = prUrl?.match(/\/pull\/(\d+)(?:$|[/?#])/)
  return match ? Number(match[1]) : undefined
}

export function readPullRequestStatus({ prReference, repository, workspace }) {
  const payload = runCommand(
    "gh",
    [
      "pr",
      "view",
      prReference,
      "--repo",
      repository,
      "--json",
      "isDraft,mergeStateStatus,number,reviewDecision,state,statusCheckRollup,title,url",
    ],
    { cwd: workspace },
  )
  return JSON.parse(payload)
}

export function evaluatePullRequestCompletion(pr) {
  if (pr.state !== "MERGED") {
    return {
      complete: false,
      reason: `PR is ${pr.state}`,
    }
  }

  return {
    complete: true,
    reason: "PR is merged",
  }
}

export function evaluatePullRequestGate(pr) {
  const checks = summarizeChecks(pr.statusCheckRollup ?? [])

  if (pr.state === "MERGED") {
    return {
      agentState: "Done",
      blockedBy: null,
      mergeReady: false,
      projectStatus: "Done",
      reason: "PR is merged",
    }
  }

  if (pr.state !== "OPEN") {
    return {
      agentState: "Human Review",
      blockedBy: `PR is ${pr.state}`,
      mergeReady: false,
      reason: `PR is ${pr.state}`,
    }
  }

  if (pr.reviewDecision === "CHANGES_REQUESTED") {
    return {
      agentState: "Changes Requested",
      blockedBy: "PR changes requested",
      mergeReady: false,
      reason: "review changes requested",
    }
  }

  if (checks.failed.length > 0) {
    return {
      agentState: "CI Repair",
      blockedBy: `Failing checks: ${checks.failed.join(", ")}`,
      mergeReady: false,
      reason: "checks failing",
    }
  }

  if (checks.pending.length > 0) {
    return {
      agentState: "Human Review",
      blockedBy: `Pending checks: ${checks.pending.join(", ")}`,
      mergeReady: false,
      reason: "checks pending",
    }
  }

  if (pr.reviewDecision && pr.reviewDecision !== "APPROVED") {
    return {
      agentState: "Human Review",
      blockedBy: `PR review decision: ${pr.reviewDecision}`,
      mergeReady: false,
      reason: "review required",
    }
  }

  if (pr.isDraft) {
    return {
      agentState: "Human Review",
      blockedBy: "PR is draft",
      mergeReady: false,
      reason: "draft PR",
    }
  }

  return {
    agentState: "Merge Ready",
    blockedBy: null,
    mergeReady: true,
    reason: "PR is ready for maintainer merge",
  }
}

export function pullRequestCompletionFieldValues({ date = new Date(), pr }) {
  return {
    Status: "Done",
    "Agent State": "Done",
    PR: pr.url,
    "Last Heartbeat": date.toISOString().slice(0, 10),
  }
}

export function pullRequestSyncFieldValues({ date = new Date(), pr, result }) {
  const values = {
    "Agent State": result.agentState,
    PR: pr.url,
    "Last Heartbeat": date.toISOString().slice(0, 10),
  }

  if (result.projectStatus) {
    values.Status = result.projectStatus
  }

  return values
}

export function summarizeChecks(checks) {
  const summary = {
    failed: [],
    pending: [],
    successful: [],
  }

  for (const check of checks) {
    const name = check.name ?? check.workflowName ?? "unnamed check"
    const status = check.status ?? ""
    const conclusion = check.conclusion ?? ""

    if (status && status !== "COMPLETED") {
      summary.pending.push(name)
      continue
    }

    if (!conclusion) {
      summary.pending.push(name)
      continue
    }

    if (failedCheckConclusions.has(conclusion)) {
      summary.failed.push(name)
      continue
    }

    if (successfulCheckConclusions.has(conclusion)) {
      summary.successful.push(name)
      continue
    }

    summary.failed.push(name)
  }

  return summary
}

function formatEvidence(evidenceReference, evidenceBody) {
  if (isRemoteReference(evidenceReference)) {
    return `- ${evidenceReference}`
  }

  return `<details>
<summary>${evidenceReference}</summary>

${evidenceBody}

</details>`
}

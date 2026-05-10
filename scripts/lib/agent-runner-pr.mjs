import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { fail, runCommand, runGit } from "./agent-project-queue.mjs"

export const openPullRequestStates = new Set(["Human Review", "CI Repair", "Changes Requested"])

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

  const evidencePath = path.resolve(repoRoot, workspaceReference, evidenceReference)
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

export function isRemoteReference(reference) {
  return /^https?:\/\//.test(reference)
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

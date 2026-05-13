import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { fail, runCommand, runGit } from "./agent-project-queue.mjs"
import { actionableReviewDetails, reviewRepairBlocker } from "./agent-runner-review.mjs"
import { localWorkspaceReferencePlan } from "./agent-runner-workspace.mjs"

export const openPullRequestStates = new Set(["Human Review", "CI Repair", "Changes Requested"])
const generatedAgentArtifactPrefixes = [
  "docs/agent-evidence/active/",
  "docs/agent-evidence/browser/",
  "docs/agent-plans/active/",
]
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
  const nonArtifactPaths = uncommittedNonAgentArtifactPaths(status)
  if (nonArtifactPaths.length > 0 && !allowDirty) {
    fail(
      `workspace has uncommitted changes outside generated agent artifacts: ${nonArtifactPaths.join(
        ", ",
      )}; commit them or pass --allow-dirty`,
    )
  }
}

export function uncommittedNonAgentArtifactPaths(status) {
  return parsePorcelainStatusPaths(status).filter((filePath) => !isAgentArtifactPath(filePath))
}

export function isAgentArtifactPath(filePath) {
  return generatedAgentArtifactPrefixes.some((prefix) => filePath.startsWith(prefix))
}

function parsePorcelainStatusPaths(status) {
  if (!status) return []

  return status
    .split("\n")
    .flatMap((line) => {
      const filePath = line.slice(3).trim()
      if (!filePath) return []
      if (filePath.includes(" -> ")) {
        return filePath.split(" -> ").map((part) => unquotePath(part))
      }
      return [unquotePath(filePath)]
    })
    .filter(Boolean)
}

function unquotePath(filePath) {
  if (!filePath.startsWith('"') || !filePath.endsWith('"')) return filePath

  try {
    return JSON.parse(filePath)
  } catch {
    return filePath.slice(1, -1)
  }
}

export function pushBranch({ branch, workspace }) {
  runGit(["push", "-u", "origin", branch], { cwd: workspace })
}

export function existingPullRequestUrl({ branch, repository, workspace }) {
  const args = ["pr", "view", branch, "--json", "url", "--jq", ".url"]
  if (repository) {
    args.push("--repo", repository)
  }

  const result = runCommand("gh", args, {
    cwd: workspace,
    allowFailure: true,
  })
  return result || undefined
}

export function createPullRequest({
  base,
  body,
  branch,
  draft = true,
  repository,
  title,
  workspace,
}) {
  return runCommand("gh", pullRequestCreateArgs({ base, body, branch, draft, repository, title }), {
    cwd: workspace,
  })
}

export function pullRequestCreateArgs({ base, body, branch, draft = true, repository, title }) {
  const args = ["pr", "create", "--base", base, "--head", branch, "--title", title, "--body", body]
  if (draft) {
    args.push("--draft")
  }
  if (repository) {
    args.push("--repo", repository)
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
  const pr = JSON.parse(payload)
  const reviewThreads = readPullRequestReviewThreads({
    prNumber: pr.number,
    repository,
    workspace,
  })

  return {
    ...pr,
    reviewThreads,
  }
}

export function readPullRequestReviewThreads({ prNumber, repository, workspace }) {
  const [owner, repo] = String(repository).split("/")
  if (!owner || !repo) {
    fail(`invalid repository: ${repository}`)
  }

  const nodes = []
  let after
  for (let page = 0; page < 100; page += 1) {
    const payload = runCommand(
      "gh",
      [
        "api",
        "graphql",
        "-f",
        `query=${reviewThreadsQuery()}`,
        "-f",
        `owner=${owner}`,
        "-f",
        `repo=${repo}`,
        "-F",
        `number=${String(prNumber)}`,
        ...(after ? ["-f", `after=${after}`] : []),
      ],
      { cwd: workspace },
    )
    const connection = reviewThreadConnection(JSON.parse(payload))
    nodes.push(...connection.nodes)

    if (!connection.pageInfo.hasNextPage) {
      return summarizeReviewThreadNodes(nodes)
    }

    if (!connection.pageInfo.endCursor) {
      fail(`PR #${String(prNumber)} review thread pagination is missing an end cursor`)
    }
    after = connection.pageInfo.endCursor
  }

  fail(`PR #${String(prNumber)} review thread pagination exceeded 100 pages`)
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
  const reviewDetails = actionableReviewDetails(pr)

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
      blockedBy: reviewRepairBlocker(reviewDetails),
      mergeReady: false,
      reason: "review changes requested",
    }
  }

  if (reviewDetails.threads.length > 0) {
    return {
      agentState: "Changes Requested",
      blockedBy: reviewRepairBlocker(reviewDetails),
      mergeReady: false,
      reason: "unresolved review threads",
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

export function summarizeReviewThreads(payload) {
  return summarizeReviewThreadNodes(reviewThreadConnection(payload).nodes)
}

function reviewThreadConnection(payload) {
  const connection = payload?.data?.repository?.pullRequest?.reviewThreads
  const nodes = connection?.nodes
  if (!Array.isArray(nodes)) {
    return {
      nodes: [],
      pageInfo: {
        endCursor: null,
        hasNextPage: false,
      },
    }
  }

  return {
    nodes,
    pageInfo: {
      endCursor: connection.pageInfo?.endCursor ?? null,
      hasNextPage: Boolean(connection.pageInfo?.hasNextPage),
    },
  }
}

function summarizeReviewThreadNodes(nodes) {
  const unresolved = nodes
    .filter((thread) => !thread.isResolved && !thread.isOutdated)
    .map((thread) => {
      const comment = thread.comments?.nodes?.[0]
      return {
        author: comment?.author?.login ?? null,
        body: comment?.body ?? null,
        line: thread.line ?? null,
        path: thread.path ?? null,
      }
    })

  return {
    unresolved,
    unresolvedCount: unresolved.length,
  }
}

function reviewThreadsQuery() {
  return `query($owner: String!, $repo: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $after) {
        nodes {
          isOutdated
          isResolved
          line
          path
          comments(first: 1) {
            nodes {
              author {
                login
              }
              body
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
}`
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

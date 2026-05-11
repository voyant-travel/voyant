import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { updateProjectItemFields } from "./lib/agent-project-fields.mjs"
import {
  currentRepositoryFromOrigin,
  fail,
  findProjectIssueItem,
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
import { localWorkspaceReferencePlan } from "./lib/agent-runner-workspace.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:publish-evidence",
  summary: "Post a local evidence packet to GitHub and update the Project evidence field.",
  usage: "pnpm agent:queue:publish-evidence -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number whose evidence packet should be published."],
    ["--evidence-path <path>", "Evidence path relative to the task workspace."],
    ["--workspace <path>", "Workspace path override."],
    ...repositoryOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("publish-evidence mode requires --issue <number>")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const item = findProjectIssueItem(project.items, {
  issueNumber: args.issue,
  repository,
})

if (item.issue.state !== "OPEN") {
  fail(`issue #${args.issue} cannot publish evidence because issue state is ${item.issue.state}`)
}

const workspaceReference = args.workspace ?? item.fields.Workspace ?? item.dryRunPlan.workspace
const evidenceReference = args.evidencePath ?? item.fields.Evidence
const { workspace } = localWorkspaceReferencePlan({
  commandName: "publish-evidence mode",
  repoRoot,
  workspaceReference,
})

if (!evidenceReference) {
  fail("publish-evidence mode requires --evidence-path or an existing Evidence field")
}

if (isRemoteEvidence(evidenceReference)) {
  fail(`Evidence already points at a remote artifact: ${evidenceReference}`)
}

const evidencePath = path.resolve(workspace, evidenceReference)
if (!existsSync(evidencePath)) {
  fail(`evidence packet does not exist: ${evidencePath}`)
}

const evidenceBody = readFileSync(evidencePath, "utf8")
if (!evidenceBody.trim()) {
  fail(`evidence packet is empty: ${evidencePath}`)
}

const marker = evidenceMarker({
  evidenceReference,
  issueNumber: item.issue.number,
  repository,
})
const existingCommentUrl = findExistingEvidenceComment({
  issueNumber: item.issue.number,
  marker,
  repository,
})

if (!args.yes) {
  console.log("agent-runner publish-evidence would update:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`evidence file: ${evidencePath}`)
  console.log(`Evidence: ${existingCommentUrl ?? "<new issue comment URL>"}`)
  fail("publish-evidence mode comments on GitHub and updates Project fields; rerun with --yes")
}

const commentUrl =
  existingCommentUrl ??
  createIssueComment({
    body: `${marker}\n\n${evidenceBody}`,
    issueNumber: item.issue.number,
    repository,
  })

updateProjectItemFields({
  project,
  item,
  values: {
    Evidence: commentUrl,
    "Last Heartbeat": today(),
  },
})

console.log("agent-runner publish-evidence: posted issue comment and updated Project fields")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`evidence: ${commentUrl}`)

function findExistingEvidenceComment({ issueNumber, marker, repository }) {
  const result = spawnSync("gh", ["api", `repos/${repository}/issues/${issueNumber}/comments`], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
  })

  if (result.error) {
    fail(`failed to run gh: ${result.error.message}`)
  }

  if (result.status !== 0) {
    const stderr = result.stderr.trim()
    fail(stderr || `gh api exited with ${result.status}`)
  }

  let payload
  try {
    payload = JSON.parse(result.stdout)
  } catch (error) {
    fail(`failed to parse gh JSON output: ${error.message}`)
  }

  const comment = payload.find((candidate) => candidate.body?.includes(marker))
  return comment?.html_url
}

function createIssueComment({ body, issueNumber, repository }) {
  const result = spawnSync(
    "gh",
    [
      "api",
      `repos/${repository}/issues/${issueNumber}/comments`,
      "-X",
      "POST",
      "-f",
      `body=${body}`,
    ],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
    },
  )

  if (result.error) {
    fail(`failed to run gh: ${result.error.message}`)
  }

  if (result.status !== 0) {
    const stderr = result.stderr.trim()
    fail(stderr || `gh api exited with ${result.status}`)
  }

  let payload
  try {
    payload = JSON.parse(result.stdout)
  } catch (error) {
    fail(`failed to parse gh JSON output: ${error.message}`)
  }

  if (!payload.html_url) {
    fail("GitHub did not return an issue comment URL")
  }

  return payload.html_url
}

function evidenceMarker({ evidenceReference, issueNumber, repository }) {
  const key = Buffer.from(`${repository}#${issueNumber}:${evidenceReference}`).toString("base64url")
  return `<!-- voyant-agent-evidence:${key} -->`
}

function isRemoteEvidence(evidence) {
  return /^https?:\/\//.test(evidence)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

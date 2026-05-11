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
  artifactPublisherFromEnv,
  evidencePacketPublicationPlan,
  publishEvidencePacket,
} from "./lib/agent-runner-artifacts.mjs"
import {
  createIssueComment,
  evidenceCommentBody,
  evidenceMarker,
  findExistingEvidenceComment,
  isRemoteEvidence,
} from "./lib/agent-runner-evidence-publication.mjs"
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
    ["--publish-artifacts", "Upload the evidence packet to configured R2/S3 object storage."],
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
if (!isPathInside(evidencePath, workspace)) {
  fail(`evidence packet is outside the workspace: ${evidenceReference}`)
}
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
const artifactPublisher = args.publishArtifacts ? artifactPublisherFromEnv() : undefined
const remoteEvidencePlan = artifactPublisher
  ? evidencePacketPublicationPlan({
      publisher: artifactPublisher,
      reference: evidenceReference,
      repository,
    })
  : undefined

if (!args.yes) {
  console.log("agent-runner publish-evidence would update:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`evidence file: ${evidencePath}`)
  if (remoteEvidencePlan) {
    console.log(`remote evidence packet: ${remoteEvidencePlan.url}`)
  }
  console.log(
    `Evidence: ${remoteEvidencePlan?.url ?? existingCommentUrl ?? "<new issue comment URL>"}`,
  )
  fail("publish-evidence mode comments on GitHub and updates Project fields; rerun with --yes")
}

const remoteEvidence =
  artifactPublisher &&
  (await publishEvidencePacket({
    body: evidenceBody,
    issueNumber: item.issue.number,
    publisher: artifactPublisher,
    reference: evidenceReference,
    repository,
  }))
const commentUrl =
  existingCommentUrl ??
  createIssueComment({
    body: evidenceCommentBody({ evidenceBody, marker, remoteEvidenceUrl: remoteEvidence?.url }),
    issueNumber: item.issue.number,
    repository,
  })

updateProjectItemFields({
  project,
  item,
  values: {
    Evidence: remoteEvidence?.url ?? commentUrl,
    "Last Heartbeat": today(),
  },
})

console.log("agent-runner publish-evidence: posted issue comment and updated Project fields")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`evidence: ${remoteEvidence?.url ?? commentUrl}`)
if (remoteEvidence) {
  console.log(`github comment: ${commentUrl}`)
}

function isPathInside(candidatePath, parentPath) {
  const relative = path.relative(parentPath, candidatePath)
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

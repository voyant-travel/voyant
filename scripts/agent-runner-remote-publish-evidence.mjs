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
  issueEventDetails,
  resolveEventLogPath,
  tryAppendAgentRunnerEvent,
} from "./lib/agent-runner-events.mjs"
import {
  createIssueComment,
  evidenceCommentBody,
  evidenceMarker,
  findExistingEvidenceComment,
  isRemoteEvidence,
} from "./lib/agent-runner-evidence-publication.mjs"
import {
  eventLogOptions,
  maybePrintHelp,
  mutationOptions,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"
import {
  decodeRemoteBase64File,
  remoteEvidencePublicationFieldValues,
  remoteEvidencePublicationPlan,
  remoteReadFileBase64Shell,
} from "./lib/agent-runner-remote-evidence.mjs"
import {
  loadRemoteWorkspaceAdapters,
  resolveRemoteWorkspaceAdapter,
} from "./lib/agent-runner-remote-workspace.mjs"
import {
  isRemoteWorkspaceDescriptor,
  parseWorkspaceReference,
} from "./lib/agent-runner-workspace-contract.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:remote-publish-evidence",
  summary: "Read a remote evidence packet, post it to GitHub, and update Project evidence.",
  usage: "pnpm agent:queue:remote-publish-evidence -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number whose remote evidence packet should be published."],
    ["--evidence-path <path>", "Evidence path relative to the remote repository directory."],
    [
      "--workspace <reference>",
      "Workspace reference override, for example sandbox:sprite:task-579.",
    ],
    ["--remote-dir <path>", "Remote repository directory."],
    ["--publish-artifacts", "Upload the evidence packet to configured R2/S3 object storage."],
    [
      "--adapter-config <path>",
      "Optional remote adapter config module. Defaults to .agents/remote-workspaces.mjs when present.",
    ],
    ["--json", "Print machine-readable JSON."],
    ...repositoryOptions,
    ...eventLogOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("remote-publish-evidence mode requires --issue <number>")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })
const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const item = findProjectIssueItem(project.items, {
  issueNumber: args.issue,
  repository,
})

if (item.issue.state !== "OPEN") {
  fail(`issue #${args.issue} cannot publish evidence because issue state is ${item.issue.state}`)
}

const workspaceReference = args.workspace ?? item.fields.Workspace ?? item.dryRunPlan.workspace
const descriptor = parseWorkspaceReference(workspaceReference, { repoRoot })
if (!isRemoteWorkspaceDescriptor(descriptor)) {
  fail(
    `remote-publish-evidence requires a remote-sandbox workspace; got ${
      descriptor.kind === "invalid" ? descriptor.reason : descriptor.kind
    }`,
  )
}

const evidenceReference = args.evidencePath ?? item.fields.Evidence
if (!evidenceReference) {
  fail("remote-publish-evidence mode requires --evidence-path or an existing Evidence field")
}

if (isRemoteEvidence(evidenceReference)) {
  fail(`Evidence already points at a remote artifact: ${evidenceReference}`)
}

const publicationPlan = remoteEvidencePublicationPlan({
  descriptor,
  evidencePath: evidenceReference,
  item,
  remoteDir: args.remoteDir,
  workspaceReference,
})

if (!publicationPlan.safeEvidencePath) {
  fail(
    `remote-publish-evidence refuses evidence outside the remote workspace: ${publicationPlan.evidenceFile}`,
  )
}

const artifactPublisher = args.publishArtifacts ? artifactPublisherFromEnv() : undefined
const remoteEvidencePlan = artifactPublisher
  ? evidencePacketPublicationPlan({
      publisher: artifactPublisher,
      reference: publicationPlan.evidencePointer,
      repository,
    })
  : undefined

if (!args.yes) {
  printPublishPlan({ item, publicationPlan, remoteEvidencePlan, repository })
  fail("remote-publish-evidence comments on GitHub and updates Project fields; rerun with --yes")
}

const adapters = await loadAdapters({ descriptor, workspaceReference })
const adapter = resolveAdapter(descriptor, { adapters })
if (!adapter.capabilities.exec) {
  failInspection(
    new Error(`remote workspace provider ${descriptor.provider} cannot exec commands`),
    {
      descriptor,
      workspaceReference,
    },
  )
}

const readResult = await runRemoteExec({
  adapter,
  args: ["-lc", remoteReadFileBase64Shell({ file: publicationPlan.evidenceFile })],
  command: "bash",
  cwd: publicationPlan.workspace,
  httpPost: true,
})

if (readResult.status !== 0) {
  failInspection(
    new Error(readResult.stderr?.trim() || `remote evidence read exited with ${readResult.status}`),
    { descriptor, workspaceReference },
  )
}

let evidenceBody
try {
  evidenceBody = decodeRemoteBase64File({
    file: publicationPlan.evidenceFile,
    stdout: readResult.stdout,
  })
} catch (error) {
  failInspection(error, { descriptor, workspaceReference })
}

if (!evidenceBody.trim()) {
  fail(`remote evidence packet is empty: ${publicationPlan.evidenceFile}`)
}

const marker = evidenceMarker({
  evidenceReference: publicationPlan.evidencePointer,
  issueNumber: item.issue.number,
  repository,
})
const existingCommentUrl = findExistingEvidenceComment({
  issueNumber: item.issue.number,
  marker,
  repository,
})
const remoteEvidence =
  artifactPublisher &&
  (await publishEvidencePacket({
    body: evidenceBody,
    issueNumber: item.issue.number,
    publisher: artifactPublisher,
    reference: publicationPlan.evidencePointer,
    repository,
  }))
const commentUrl =
  existingCommentUrl ??
  createIssueComment({
    body: evidenceCommentBody({ evidenceBody, marker, remoteEvidenceUrl: remoteEvidence?.url }),
    issueNumber: item.issue.number,
    repository,
  })
const evidenceUrl = remoteEvidence?.url ?? commentUrl

updateProjectItemFields({
  item,
  project,
  values: remoteEvidencePublicationFieldValues({ evidenceUrl }),
})
tryAppendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "remote-publish-evidence.completed",
    evidence: evidenceUrl,
    githubComment: commentUrl,
    issue: issueEventDetails(item),
    publishedArtifact: remoteEvidence ?? null,
    repository,
    sourceEvidence: publicationPlan.evidencePointer,
    workspace: workspaceReference,
  },
})

if (args.json) {
  console.log(
    JSON.stringify(
      {
        evidence: evidenceUrl,
        githubComment: commentUrl,
        issue: item.issue,
        publishedArtifact: remoteEvidence ?? null,
        publicationPlan,
        repository,
        workspaceReference,
      },
      null,
      2,
    ),
  )
} else {
  console.log("agent-runner remote-publish-evidence: posted evidence and updated Project fields")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`workspace: ${workspaceReference}`)
  console.log(`remote evidence: ${publicationPlan.evidenceFile}`)
  console.log(`evidence: ${evidenceUrl}`)
  if (remoteEvidence) {
    console.log(`github comment: ${commentUrl}`)
  }
}

async function loadAdapters({ descriptor, workspaceReference }) {
  try {
    return await loadRemoteWorkspaceAdapters({
      configPath: args.adapterConfig,
      repoRoot,
    })
  } catch (error) {
    failInspection(error, { descriptor, workspaceReference })
  }
}

function resolveAdapter(descriptor, { adapters }) {
  try {
    return resolveRemoteWorkspaceAdapter(descriptor, { adapters })
  } catch (error) {
    failInspection(error, { descriptor, workspaceReference })
  }
}

async function runRemoteExec({ adapter, ...command }) {
  try {
    return await adapter.exec(command)
  } catch (error) {
    return {
      status: 1,
      stderr: error instanceof Error ? error.message : String(error),
      stdout: "",
    }
  }
}

function failInspection(error, { descriptor, workspaceReference }) {
  const message = error instanceof Error ? error.message : String(error)
  if (args.json) {
    console.log(
      JSON.stringify(
        {
          error: message,
          repository,
          workspace: {
            descriptor,
            reference: workspaceReference,
          },
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  fail(message)
}

function printPublishPlan({ item, publicationPlan, remoteEvidencePlan, repository }) {
  console.log("agent-runner remote-publish-evidence would update:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`workspace: ${publicationPlan.workspaceReference}`)
  console.log(`remote evidence file: ${publicationPlan.evidenceFile}`)
  if (remoteEvidencePlan) {
    console.log(`remote evidence packet: ${remoteEvidencePlan.url}`)
  }
  console.log(`Evidence: ${remoteEvidencePlan?.url ?? "<new issue comment URL>"}`)
}

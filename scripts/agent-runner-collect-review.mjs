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
  issueEventDetails,
  resolveEventLogPath,
  tryAppendAgentRunnerEvent,
} from "./lib/agent-runner-events.mjs"
import {
  eventLogOptions,
  maybePrintHelp,
  mutationOptions,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"
import { pullRequestNumberFromUrl, readPullRequestStatus } from "./lib/agent-runner-pr.mjs"
import {
  actionableReviewDetails,
  reviewRepairArtifactPlan,
  reviewRepairBlocker,
  writeReviewRepairEvidencePacket,
} from "./lib/agent-runner-review.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:collect-review",
  summary: "Collect current PR review feedback into a local review repair evidence packet.",
  usage: "pnpm agent:queue:collect-review -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number whose linked PR should be inspected."],
    ["--pr <url-or-number>", "PR URL or number override. Defaults from the Project PR field."],
    ["--workspace <path>", "Workspace path override for gh context."],
    ...repositoryOptions,
    ...eventLogOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("collect-review mode requires --issue <number>")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })
const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const item = findProjectIssueItem(project.items, {
  issueNumber: args.issue,
  repository,
})
const prReference = normalizePrReference(args.pr ?? item.fields.PR)

if (!prReference) {
  fail("collect-review mode requires --pr or an existing Project PR field")
}

const workspace = args.workspace ?? repoRoot
const pr = readPullRequestStatus({ prReference, repository, workspace })
const details = actionableReviewDetails(pr)

if (!details.actionable) {
  fail("collect-review mode found no requested changes or unresolved current review threads")
}

const artifactPlan = reviewRepairArtifactPlan({ item, repoRoot })
const values = {
  "Agent State": "Changes Requested",
  "Last Heartbeat": today(),
  Evidence: artifactPlan.evidencePointer,
  "Blocked By": reviewRepairBlocker(details),
}

if (!args.yes) {
  printCollectPlan({ artifactPlan, details, item, pr, repository, values })
  fail(
    "collect-review mode writes local review evidence and updates Project fields; rerun with --yes",
  )
}

writeReviewRepairEvidencePacket({ artifactPlan, details, item, pr, repository })
updateProjectItemFields({ project, item, values })
tryAppendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "collect-review.completed",
    evidence: artifactPlan.evidencePointer,
    fields: values,
    issue: issueEventDetails(item),
    pr: {
      number: pr.number,
      url: pr.url,
    },
    repository,
    reviewDecision: details.reviewDecision,
    unresolvedReviewThreads: details.threads.length,
  },
})

console.log("agent-runner collect-review: wrote review repair evidence and updated Project fields")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`pr: ${pr.url}`)
console.log(`evidence: ${artifactPlan.evidenceFile}`)

function normalizePrReference(value) {
  if (!value) return undefined
  return String(pullRequestNumberFromUrl(value) ?? value)
}

function printCollectPlan({ artifactPlan, details, item, pr, repository, values }) {
  console.log("agent-runner collect-review would write:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`pr: ${pr.url}`)
  console.log(`evidence: ${artifactPlan.evidenceFile}`)
  console.log(`review decision: ${details.reviewDecision || "none"}`)
  console.log(`unresolved review threads: ${String(details.threads.length)}`)
  for (const [fieldName, value] of Object.entries(values)) {
    console.log(`${fieldName}: ${value}`)
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

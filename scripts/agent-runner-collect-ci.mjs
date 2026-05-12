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
  ciRepairArtifactPlan,
  collectFailedCheckLogs,
  failingCheckDetails,
  writeCiRepairEvidencePacket,
} from "./lib/agent-runner-ci.mjs"
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

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:collect-ci",
  summary: "Collect failed PR check context into a local CI repair evidence packet.",
  usage: "pnpm agent:queue:collect-ci -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number whose linked PR should be inspected."],
    ["--pr <url-or-number>", "PR URL or number override. Defaults from the Project PR field."],
    ["--workspace <path>", "Workspace path override for gh context."],
    ["--max-log-bytes <number>", "Maximum failed log bytes per run. Defaults to 120000."],
    ...repositoryOptions,
    ...eventLogOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("collect-ci mode requires --issue <number>")
}

const maxLogBytes = Number(args.maxLogBytes ?? 120_000)
if (!Number.isInteger(maxLogBytes) || maxLogBytes < 1) {
  fail(`invalid max log bytes: ${String(args.maxLogBytes)}`)
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
  fail("collect-ci mode requires --pr or an existing Project PR field")
}

const workspace = args.workspace ?? repoRoot
const pr = readPullRequestStatus({ prReference, repository, workspace })
const checks = failingCheckDetails(pr)

if (checks.length === 0) {
  fail("collect-ci mode found no failing PR checks")
}

const artifactPlan = ciRepairArtifactPlan({ item, repoRoot })
const values = {
  "Agent State": "CI Repair",
  "Last Heartbeat": today(),
  Evidence: artifactPlan.evidencePointer,
  "Blocked By": `Failing checks: ${checks.map((check) => check.name).join(", ")}`,
}

if (!args.yes) {
  printCollectPlan({ artifactPlan, checks, item, pr, repository, values })
  fail("collect-ci mode writes local CI evidence and updates Project fields; rerun with --yes")
}

const logs = collectFailedCheckLogs({
  checks,
  maxLogBytes,
  repository,
  workspace,
})
writeCiRepairEvidencePacket({ artifactPlan, checks, item, logs, pr, repository })
updateProjectItemFields({ project, item, values })
tryAppendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "collect-ci.completed",
    checks: checks.map((check) => ({
      name: check.name,
      status: check.status,
      conclusion: check.conclusion,
    })),
    evidence: artifactPlan.evidencePointer,
    fields: values,
    issue: issueEventDetails(item),
    pr: {
      number: pr.number,
      url: pr.url,
    },
    repository,
  },
})

console.log("agent-runner collect-ci: wrote CI repair evidence and updated Project fields")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`pr: ${pr.url}`)
console.log(`evidence: ${artifactPlan.evidenceFile}`)

function normalizePrReference(value) {
  if (!value) return undefined
  return String(pullRequestNumberFromUrl(value) ?? value)
}

function printCollectPlan({ artifactPlan, checks, item, pr, repository, values }) {
  console.log("agent-runner collect-ci would write:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`pr: ${pr.url}`)
  console.log(`evidence: ${artifactPlan.evidenceFile}`)
  console.log(`failed checks: ${checks.map((check) => check.name).join(", ")}`)
  for (const [fieldName, value] of Object.entries(values)) {
    console.log(`${fieldName}: ${value}`)
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

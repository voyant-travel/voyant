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
import {
  evaluatePullRequestGate,
  pullRequestNumberFromUrl,
  pullRequestSyncFieldValues,
  readPullRequestStatus,
} from "./lib/agent-runner-pr.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:sync-pr",
  summary: "Read a linked PR/check status and update the Project item review state.",
  usage: "pnpm agent:queue:sync-pr -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number whose linked PR should be synced."],
    ["--pr <url-or-number>", "PR URL or number override. Defaults from the Project PR field."],
    ["--workspace <path>", "Workspace path override for gh context."],
    ["--force", "Allow syncing closed issues."],
    ...repositoryOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("sync-pr mode requires --issue <number>")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const item = findProjectIssueItem(project.items, {
  issueNumber: args.issue,
  repository,
})

if (item.issue.state !== "OPEN" && !args.force) {
  fail(`issue #${args.issue} cannot sync PR because issue state is ${item.issue.state}`)
}

const prReference = normalizePrReference(args.pr ?? item.fields.PR)
if (!prReference) {
  fail("sync-pr mode requires --pr or an existing Project PR field")
}

const workspace = args.workspace ?? repoRoot
const pr = readPullRequestStatus({ prReference, repository, workspace })
const result = evaluatePullRequestGate(pr)
const values = pullRequestSyncFieldValues({ pr, result })
const clear = result.blockedBy ? [] : ["Blocked By"]
if (result.blockedBy) {
  values["Blocked By"] = result.blockedBy
}

if (!args.yes) {
  printSyncPlan({ item, pr, repository, result, values, clear })
  fail("sync-pr mode updates GitHub Project fields; rerun with --yes")
}

updateProjectItemFields({ project, item, values, clear })

console.log("agent-runner sync-pr: updated Project PR review state")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`pr: ${pr.url}`)
console.log(`agent state: ${result.agentState}`)
console.log(`reason: ${result.reason}`)

function normalizePrReference(value) {
  if (!value) return undefined
  return String(pullRequestNumberFromUrl(value) ?? value)
}

function printSyncPlan({ clear, item, pr, repository, result, values }) {
  console.log("agent-runner sync-pr would update:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`pr: ${pr.url}`)
  console.log(`reason: ${result.reason}`)
  for (const [fieldName, value] of Object.entries(values)) {
    console.log(`${fieldName}: ${value}`)
  }
  for (const fieldName of clear) {
    console.log(`${fieldName}: <clear>`)
  }
}

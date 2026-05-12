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
import {
  evaluatePullRequestGate,
  evidenceForPullRequest,
  pullRequestBody,
  pullRequestNumberFromUrl,
  pullRequestSyncFieldValues,
  readPullRequestStatus,
  updatePullRequestBody,
} from "./lib/agent-runner-pr.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:sync-pr",
  summary: "Read a linked PR/check status and update the Project item review state.",
  usage: "pnpm agent:queue:sync-pr -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number whose linked PR should be synced."],
    ["--pr <url-or-number>", "PR URL or number override. Defaults from the Project PR field."],
    ["--evidence <url-or-path>", "Evidence override for --update-body."],
    ["--workspace <path>", "Workspace path override for gh context."],
    ["--update-body", "Refresh the PR body from the current evidence packet."],
    ["--force", "Allow syncing closed issues."],
    ...repositoryOptions,
    ...eventLogOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("sync-pr mode requires --issue <number>")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })
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
const bodyRefresh = args.updateBody
  ? buildBodyRefresh({
      evidenceReference: args.evidence ?? item.fields.Evidence,
      item,
      prReference,
      repoRoot,
      repository,
      workspace,
    })
  : null

if (!args.yes) {
  printSyncPlan({ bodyRefresh, item, pr, repository, result, values, clear })
  fail("sync-pr mode updates GitHub Project fields; rerun with --yes")
}

if (bodyRefresh) {
  updatePullRequestBody(bodyRefresh)
}
updateProjectItemFields({ project, item, values, clear })
tryAppendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "sync-pr.completed",
    bodyRefreshed: Boolean(bodyRefresh),
    clearedFields: clear,
    fields: values,
    issue: issueEventDetails(item),
    pr: {
      number: pr.number,
      url: pr.url,
    },
    reason: result.reason,
    repository,
  },
})

console.log("agent-runner sync-pr: updated Project PR review state")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`pr: ${pr.url}`)
console.log(`agent state: ${result.agentState}`)
console.log(`reason: ${result.reason}`)
if (bodyRefresh) {
  console.log("pr body: refreshed from evidence")
}

function normalizePrReference(value) {
  if (!value) return undefined
  return String(pullRequestNumberFromUrl(value) ?? value)
}

function buildBodyRefresh({
  evidenceReference,
  item,
  prReference,
  repoRoot,
  repository,
  workspace,
}) {
  const evidence = evidenceForPullRequest({
    evidenceReference,
    repoRoot,
    workspaceReference: item.fields.Workspace ?? item.dryRunPlan.workspace,
  })

  return {
    body: pullRequestBody(item, {
      ...evidence,
      repository,
    }),
    prReference,
    repository,
    workspace,
  }
}

function printSyncPlan({ bodyRefresh, clear, item, pr, repository, result, values }) {
  console.log("agent-runner sync-pr would update:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`pr: ${pr.url}`)
  console.log(`reason: ${result.reason}`)
  if (bodyRefresh) {
    console.log("pr body: refresh from evidence")
  }
  for (const [fieldName, value] of Object.entries(values)) {
    console.log(`${fieldName}: ${value}`)
  }
  for (const fieldName of clear) {
    console.log(`${fieldName}: <clear>`)
  }
}

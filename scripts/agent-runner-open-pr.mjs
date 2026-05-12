import { existsSync } from "node:fs"

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
  assertWorkspaceReadyForPullRequest,
  createPullRequest,
  evidenceForPullRequest,
  existingPullRequestUrl,
  openPullRequestStates,
  pullRequestBody,
  pullRequestFieldValues,
  pullRequestTitle,
  pushBranch,
} from "./lib/agent-runner-pr.mjs"
import { localWorkspaceReferencePlan } from "./lib/agent-runner-workspace.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:open-pr",
  summary: "Push a handed-off branch, open or reuse a draft PR, and update Project PR metadata.",
  usage: "pnpm agent:queue:open-pr -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number whose branch should be published."],
    ["--base <ref>", "Base branch for the pull request. Defaults to main."],
    ["--branch <name>", "Branch override. Defaults from the Project Branch field."],
    ["--workspace <path>", "Workspace path override."],
    ["--evidence <url-or-path>", "Evidence override. Defaults from the Project Evidence field."],
    ["--ready", "Open a ready-for-review PR instead of a draft PR."],
    ["--allow-dirty", "Allow opening a PR from a workspace with uncommitted changes."],
    ["--force", "Allow opening outside the normal handoff states."],
    ...repositoryOptions,
    ...eventLogOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("open-pr mode requires --issue <number>")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })
const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const item = findProjectIssueItem(project.items, {
  issueNumber: args.issue,
  repository,
})
const currentState = item.fields["Agent State"]

if (item.issue.state !== "OPEN") {
  fail(`issue #${args.issue} cannot open a PR because issue state is ${item.issue.state}`)
}

if (!args.force && !openPullRequestStates.has(currentState)) {
  fail(
    `issue #${args.issue} is not in an open-pr Agent State: ${
      currentState ?? "unset"
    }; pass --force to override`,
  )
}

const branch = args.branch ?? item.fields.Branch ?? item.dryRunPlan.branch
const workspaceReference = args.workspace ?? item.fields.Workspace ?? item.dryRunPlan.workspace
const { workspace } = localWorkspaceReferencePlan({
  commandName: "open-pr mode",
  repoRoot,
  workspaceReference,
})
if (!existsSync(workspace)) {
  fail(`workspace does not exist: ${workspace}`)
}
const evidence = evidenceForPullRequest({
  evidenceReference: args.evidence ?? item.fields.Evidence,
  repoRoot,
  workspaceReference,
})
const title = pullRequestTitle(item)
const body = pullRequestBody(item, {
  ...evidence,
  repository,
})
const base = args.base ?? "main"
const existingPrUrl = item.fields.PR || existingPullRequestUrl({ branch, workspace })
const values = pullRequestFieldValues({
  prUrl: existingPrUrl ?? "<new pull request URL>",
})

if (!args.yes) {
  printOpenPrPlan({ base, branch, existingPrUrl, item, repository, title, values, workspace })
  fail("open-pr mode pushes a branch, opens a PR, and updates Project fields; rerun with --yes")
}

assertWorkspaceReadyForPullRequest({
  allowDirty: Boolean(args.allowDirty),
  branch,
  workspace,
})
pushBranch({ branch, workspace })

const prUrl =
  existingPrUrl ??
  createPullRequest({
    base,
    body,
    branch,
    draft: !args.ready,
    title,
    workspace,
  })

updateProjectItemFields({
  project,
  item,
  values: pullRequestFieldValues({ prUrl }),
})
tryAppendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "open-pr.completed",
    base,
    branch,
    draft: !args.ready,
    issue: issueEventDetails(item),
    pr: {
      url: prUrl,
    },
    repository,
    reused: Boolean(existingPrUrl),
    workspace,
  },
})

console.log("agent-runner open-pr: pushed branch, opened or reused PR, and updated Project fields")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`branch: ${branch}`)
console.log(`workspace: ${workspace}`)
console.log(`pr: ${prUrl}`)

function printOpenPrPlan({
  base,
  branch,
  existingPrUrl,
  item,
  repository,
  title,
  values,
  workspace,
}) {
  console.log("agent-runner open-pr would update:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`base: ${base}`)
  console.log(`branch: ${branch}`)
  console.log(`workspace: ${workspace}`)
  console.log(`title: ${title}`)
  console.log(`PR: ${existingPrUrl ?? "<new draft pull request URL>"}`)
  for (const [fieldName, value] of Object.entries(values)) {
    console.log(`${fieldName}: ${value}`)
  }
}

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
  evaluatePullRequestCompletion,
  pullRequestCompletionFieldValues,
  pullRequestNumberFromUrl,
  readPullRequestStatus,
} from "./lib/agent-runner-pr.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:complete-pr",
  summary: "Mark Project work done after a maintainer has merged the linked PR.",
  usage: "pnpm agent:queue:complete-pr -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number whose linked PR should be completed."],
    ["--pr <url-or-number>", "PR URL or number override. Defaults from the Project PR field."],
    ["--workspace <path>", "Workspace path override for gh context."],
    ...repositoryOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("complete-pr mode requires --issue <number>")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const item = findProjectIssueItem(project.items, {
  issueNumber: args.issue,
  repository,
})
const prReference = normalizePrReference(args.pr ?? item.fields.PR)
if (!prReference) {
  fail("complete-pr mode requires --pr or an existing Project PR field")
}

const workspace = args.workspace ?? repoRoot
const pr = readPullRequestStatus({ prReference, repository, workspace })
const result = evaluatePullRequestCompletion(pr)
if (!result.complete) {
  fail(`issue #${args.issue} cannot be completed because ${result.reason}`)
}

const values = pullRequestCompletionFieldValues({ pr })
const clear = ["Blocked By"]

if (!args.yes) {
  printCompletionPlan({ clear, item, pr, repository, result, values })
  fail("complete-pr mode updates GitHub Project fields; rerun with --yes")
}

updateProjectItemFields({ project, item, values, clear })

console.log("agent-runner complete-pr: marked Project item done")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`pr: ${pr.url}`)
console.log("agent state: Done")
console.log("")
console.log("No PR was merged by this command. No branch or worktree was deleted.")

function normalizePrReference(value) {
  if (!value) return undefined
  return String(pullRequestNumberFromUrl(value) ?? value)
}

function printCompletionPlan({ clear, item, pr, repository, result, values }) {
  console.log("agent-runner complete-pr would update:")
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

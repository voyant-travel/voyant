import {
  currentRepositoryFromOrigin,
  fail,
  findSelectedReadyItem,
  loadAllEvaluatedProject,
  parseArgs,
  projectScanConfigFromArgs,
  runGit,
} from "./lib/agent-project-queue.mjs"
import { claimFieldValues, claimProjectItem, printClaimUpdate } from "./lib/agent-runner-claim.mjs"
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
  prepareWorkspace,
  printWorkspacePlan,
  workspacePlan,
} from "./lib/agent-runner-workspace.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:start",
  summary: "Create a local worktree, write the execution plan, and claim one approved item.",
  usage: "pnpm agent:queue:start -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number to start. Required when multiple items are ready."],
    ["--base <ref>", "Base ref for the new worktree branch. Defaults to origin/main."],
    ...repositoryOptions,
    ...eventLogOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })
const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const item = findSelectedReadyItem(project.items, {
  issueNumber: args.issue,
  repository,
})
const baseRef = args.base ?? "origin/main"
const plan = workspacePlan({ baseRef, item, repoRoot })
const claimedAt = new Date()
const values = claimFieldValues(item, claimedAt)

if (!args.yes) {
  printWorkspacePlan({ item, plan, repository })
  console.log("")
  printClaimUpdate({ action: "start", item, repository, values })
  fail("start mode creates a worktree and updates GitHub Project fields; rerun with --yes")
}

prepareWorkspace({ baseRef, item, repoRoot })
claimProjectItem({ date: claimedAt, item, project })
tryAppendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "start.completed",
    baseRef,
    branch: plan.branch,
    fields: values,
    issue: issueEventDetails(item),
    planPath: plan.planPath,
    repository,
    workspace: plan.workspace,
  },
})

console.log("agent-runner start: created local workspace and claimed Project item")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`branch: ${plan.branch}`)
console.log(`workspace: ${plan.workspace}`)
console.log(`plan: ${plan.planPath}`)
console.log("agent state: Planning")
console.log("")
console.log("No agent was run. No branch was pushed.")

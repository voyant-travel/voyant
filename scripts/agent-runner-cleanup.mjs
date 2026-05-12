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
  canCleanupAgentState,
  cleanupFieldValues,
  cleanupWorkspacePlan,
  removeWorkspace,
} from "./lib/agent-runner-workspace.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:cleanup",
  summary: "Remove a completed local worktree and clear its Project workspace pointer.",
  usage: "pnpm agent:queue:cleanup -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number whose local workspace should be removed."],
    ["--workspace <path>", "Workspace path override. Defaults from the Project Workspace field."],
    ["--force", "Allow cleanup outside Done or Abandoned Agent State."],
    ...repositoryOptions,
    ...eventLogOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("cleanup mode requires --issue <number>")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })
const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const item = findProjectIssueItem(project.items, {
  issueNumber: args.issue,
  repository,
})
const agentState = item.fields["Agent State"]

if (!canCleanupAgentState(agentState, { force: Boolean(args.force) })) {
  fail(
    `issue #${args.issue} is not in a cleanup Agent State: ${
      agentState ?? "unset"
    }; pass --force to override`,
  )
}

const plan = cleanupWorkspacePlan({
  item,
  repoRoot,
  workspaceReference: args.workspace,
})

if (!plan.safeWorkspace) {
  fail(`cleanup refuses workspace outside .agent-worktrees: ${plan.workspace}`)
}

const values = cleanupFieldValues()
const clear = ["Workspace"]

if (!args.yes) {
  printCleanupPlan({ clear, item, plan, repository, values })
  fail("cleanup mode removes a local worktree and updates Project fields; rerun with --yes")
}

updateProjectItemFields({ project, item, values, clear })
const removedWorkspace = removeWorkspace({ allowMissing: true, workspace: plan.workspace })
tryAppendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "cleanup.completed",
    clearedFields: clear,
    fields: values,
    issue: issueEventDetails(item),
    removedWorkspace,
    repository,
    workspace: plan.workspace,
  },
})

console.log(cleanupResultMessage(removedWorkspace))
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`workspace: ${plan.workspace}`)
console.log("")
console.log("No branch was deleted. No remote state was changed except Project fields.")

function printCleanupPlan({ clear, item, plan, repository, values }) {
  console.log("agent-runner cleanup would remove:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`workspace: ${plan.workspace}`)
  for (const [fieldName, value] of Object.entries(values)) {
    console.log(`${fieldName}: ${value}`)
  }
  for (const fieldName of clear) {
    console.log(`${fieldName}: <clear>`)
  }
}

function cleanupResultMessage(removedWorkspace) {
  if (removedWorkspace) {
    return "agent-runner cleanup: removed local workspace and cleared Project workspace"
  }

  return "agent-runner cleanup: workspace already absent; cleared Project workspace"
}

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

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:claim",
  summary: "Mark one approved Project item as claimed before implementation starts.",
  usage: "pnpm agent:queue:claim -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number to claim. Required when multiple items are ready."],
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
const claimedAt = new Date()
const values = claimFieldValues(item, claimedAt)

if (!args.yes) {
  printClaimUpdate({ item, repository, values })
  fail("claim mode updates GitHub Project fields; rerun with --yes to continue")
}

claimProjectItem({ date: claimedAt, item, project })
tryAppendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "claim.completed",
    fields: values,
    issue: issueEventDetails(item),
    repository,
  },
})

console.log("agent-runner claim: updated GitHub Project fields")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`branch: ${item.dryRunPlan.branch}`)
console.log(`workspace: ${item.dryRunPlan.workspace}`)
console.log("agent state: Planning")
console.log("")
console.log("No agent was run. No branch was pushed.")

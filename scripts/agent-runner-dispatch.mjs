import {
  currentRepositoryFromOrigin,
  fail,
  filterItemsByRepository,
  loadAllEvaluatedProject,
  parseArgs,
  projectScanConfigFromArgs,
  runGit,
} from "./lib/agent-project-queue.mjs"
import {
  dispatchableActions,
  dispatchCommandArgs,
  runDispatchCommand,
  selectDispatchRecommendation,
} from "./lib/agent-runner-dispatch.mjs"
import {
  maybePrintHelp,
  mutationOptions,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"
import { recommendQueueActions } from "./lib/agent-runner-tick.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:dispatch",
  summary: "Run one allow-listed queue recommendation from tick.",
  usage: "pnpm agent:queue:dispatch -- [--issue <number>] [--action start] --yes",
  options: [
    ["--issue <number>", "Only dispatch a recommendation for this issue number."],
    [
      "--action <name>",
      `Only dispatch this action. Allowed: ${Array.from(dispatchableActions).join(", ")}.`,
    ],
    ["--max-age-days <number>", "Heartbeat staleness threshold. Defaults to 1."],
    ...repositoryOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const maxAgeDays = Number(args.maxAgeDays ?? 1)

if (!Number.isInteger(maxAgeDays) || maxAgeDays < 0) {
  fail(`invalid max age days: ${String(args.maxAgeDays)}`)
}

if (args.action && !dispatchableActions.has(args.action)) {
  fail(`action ${args.action} is not dispatchable`)
}

const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const items = filterItemsByRepository(project.items, repository)
const recommendations = recommendQueueActions(items, { maxAgeDays, repository })
let selection
try {
  selection = selectDispatchRecommendation(recommendations, {
    action: args.action,
    issueNumber: args.issue,
  })
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

const { recommendation, reason } = selection

if (!recommendation) {
  fail(reason)
}

const commandArgs = dispatchCommandArgs(recommendation, { repository })

if (!args.yes) {
  printDispatchPlan({ commandArgs, recommendation, repository })
  fail("dispatch mode runs one queue mutation; rerun with --yes")
}

const status = runDispatchCommand(commandArgs)
process.exitCode = status ?? 1

function printDispatchPlan({ commandArgs, recommendation, repository }) {
  console.log("agent-runner dispatch would run:")
  console.log(`issue: #${recommendation.issue.number} ${recommendation.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`action: ${recommendation.action}`)
  console.log(`reason: ${recommendation.reason}`)
  console.log(`command: pnpm ${commandArgs.join(" ")}`)
}

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
  appendAgentRunnerEvent,
  recommendationEventDetails,
  resolveEventLogPath,
} from "./lib/agent-runner-events.mjs"
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
    ["--event-log <path>", "JSONL audit log path. Defaults to .agent-runs/events.jsonl."],
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
const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })

if (!args.yes) {
  printDispatchPlan({ commandArgs, eventLogPath, recommendation, repository })
  fail("dispatch mode runs one queue mutation; rerun with --yes")
}

appendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "dispatch.started",
    command: ["pnpm", ...commandArgs],
    repository,
    recommendation: recommendationEventDetails(recommendation),
  },
})
const status = runDispatchCommand(commandArgs)
appendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "dispatch.completed",
    repository,
    status: status ?? 1,
    recommendation: recommendationEventDetails(recommendation),
  },
})
process.exitCode = status ?? 1

function printDispatchPlan({ commandArgs, eventLogPath, recommendation, repository }) {
  console.log("agent-runner dispatch would run:")
  console.log(`issue: #${recommendation.issue.number} ${recommendation.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`action: ${recommendation.action}`)
  console.log(`reason: ${recommendation.reason}`)
  console.log(`command: pnpm ${commandArgs.join(" ")}`)
  console.log(`event log: ${eventLogPath}`)
}

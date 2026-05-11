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
import { normalizeLoopOptions, shouldContinueLoop } from "./lib/agent-runner-loop.mjs"
import { recommendQueueActions } from "./lib/agent-runner-tick.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:loop",
  summary: "Run a bounded loop of allow-listed queue dispatches.",
  usage: "pnpm agent:queue:loop -- --iterations 3 --yes",
  options: [
    ["--iterations <number>", "Maximum dispatch iterations, 1..100. Defaults to 1."],
    ["--sleep-seconds <number>", "Delay between successful dispatches, 0..3600. Defaults to 60."],
    ["--issue <number>", "Only dispatch recommendations for this issue number."],
    [
      "--action <name>",
      `Only dispatch this action. Allowed: ${Array.from(dispatchableActions).join(", ")}.`,
    ],
    ["--max-age-days <number>", "Heartbeat staleness threshold. Defaults to 1."],
    ["--event-log <path>", "JSONL audit log path. Defaults to .agent-runs/events.jsonl."],
    ["--update-body", "When dispatching sync-pr, refresh the PR body from evidence."],
    ...repositoryOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const maxAgeDays = Number(args.maxAgeDays ?? 1)
const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })

if (!Number.isInteger(maxAgeDays) || maxAgeDays < 0) {
  fail(`invalid max age days: ${String(args.maxAgeDays)}`)
}

if (args.action && !dispatchableActions.has(args.action)) {
  fail(`action ${args.action} is not dispatchable`)
}

let loopOptions
try {
  loopOptions = normalizeLoopOptions({
    iterations: args.iterations,
    sleepSeconds: args.sleepSeconds,
  })
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

for (let iteration = 1; iteration <= loopOptions.iterations; iteration += 1) {
  const recommendation = selectLoopRecommendation()
  if (!recommendation) break

  const commandArgs = dispatchCommandArgs(recommendation, {
    eventLog: args.eventLog,
    repository,
    updateBody: Boolean(args.updateBody),
  })

  if (!args.yes) {
    printLoopPlan({ commandArgs, iteration, recommendation })
    fail("loop mode runs queue mutations; rerun with --yes")
  }

  console.log(`agent-runner loop: dispatch ${iteration}/${loopOptions.iterations}`)
  console.log(`command: pnpm ${commandArgs.join(" ")}`)
  appendAgentRunnerEvent({
    eventLogPath,
    event: {
      type: "loop.iteration.started",
      command: ["pnpm", ...commandArgs],
      iteration,
      iterations: loopOptions.iterations,
      repository,
      recommendation: recommendationEventDetails(recommendation),
    },
  })
  const status = runDispatchCommand(commandArgs) ?? 1
  appendAgentRunnerEvent({
    eventLogPath,
    event: {
      type: "loop.iteration.completed",
      iteration,
      iterations: loopOptions.iterations,
      repository,
      status,
      recommendation: recommendationEventDetails(recommendation),
    },
  })
  if (!shouldContinueLoop({ iteration, iterations: loopOptions.iterations, status })) {
    process.exitCode = status
    break
  }

  if (loopOptions.sleepMs > 0) {
    await sleep(loopOptions.sleepMs)
  }
}

function selectLoopRecommendation() {
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

  if (!selection.recommendation) {
    console.log(`agent-runner loop: ${selection.reason}`)
    return null
  }

  return selection.recommendation
}

function printLoopPlan({ commandArgs, iteration, recommendation }) {
  console.log("agent-runner loop would run:")
  console.log(`iteration: ${iteration}/${loopOptions.iterations}`)
  console.log(`issue: #${recommendation.issue.number} ${recommendation.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`action: ${recommendation.action}`)
  console.log(`reason: ${recommendation.reason}`)
  console.log(`command: pnpm ${commandArgs.join(" ")}`)
  console.log(`event log: ${eventLogPath}`)
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

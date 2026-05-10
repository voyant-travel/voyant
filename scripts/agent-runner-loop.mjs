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

  const commandArgs = dispatchCommandArgs(recommendation, { repository })

  if (!args.yes) {
    printLoopPlan({ commandArgs, iteration, recommendation })
    fail("loop mode runs queue mutations; rerun with --yes")
  }

  console.log(`agent-runner loop: dispatch ${iteration}/${loopOptions.iterations}`)
  console.log(`command: pnpm ${commandArgs.join(" ")}`)
  const status = runDispatchCommand(commandArgs) ?? 1
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
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

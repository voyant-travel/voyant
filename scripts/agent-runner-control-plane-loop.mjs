import { currentRepositoryFromOrigin, fail, parseArgs, runGit } from "./lib/agent-project-queue.mjs"
import { ciRepairCommandOptions } from "./lib/agent-runner-ci-repair-command.mjs"
import {
  controlPlaneConfigFromArgs,
  finishDispatchIntent,
  requestLatestDispatchIntent,
  submitTickSnapshot,
} from "./lib/agent-runner-control-plane.mjs"
import {
  buildLatestDispatchIntentRequest,
  generateControlPlaneTickSnapshot,
} from "./lib/agent-runner-control-plane-tick.mjs"
import { dispatchableActions } from "./lib/agent-runner-dispatch.mjs"
import { runLeasedDispatchIntent } from "./lib/agent-runner-dispatch-intent-runner.mjs"
import { resolveEventLogPath, tryAppendAgentRunnerEvent } from "./lib/agent-runner-events.mjs"
import {
  eventLogOptions,
  maybePrintHelp,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"
import { normalizeLoopOptions, shouldContinueLoop } from "./lib/agent-runner-loop.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:control-plane-loop",
  summary: "Submit fresh queue snapshots and run leased control-plane dispatch intents.",
  usage: "pnpm agent:queue:control-plane-loop -- --holder <id> --iterations 3 --yes",
  options: [
    ["--control-plane-url <url>", "Control-plane base URL. Defaults to AGENT_CONTROL_PLANE_URL."],
    ["AGENT_CONTROL_PLANE_TOKEN", "Bearer token environment variable used for API routes."],
    ["--holder <id>", "Supervisor or runner identifier recorded on each lease."],
    ["--iterations <number>", "Maximum loop iterations, 1..100. Defaults to 1."],
    ["--sleep-seconds <number>", "Delay between successful dispatches, 0..3600. Defaults to 60."],
    ["--ttl-seconds <number>", "Lease TTL in seconds, 60..3600. Defaults to 900."],
    ["--issue <number>", "Only lease recommendations for this issue number."],
    [
      "--action <name>",
      `Only lease this action. Allowed: ${Array.from(dispatchableActions).join(", ")}.`,
    ],
    ["--max-age-days <number>", "Heartbeat staleness threshold. Defaults to 1."],
    ["--recent-events <number>", "Number of recent runner events to include. Defaults to 5."],
    ...ciRepairCommandOptions,
    ...eventLogOptions,
    ["--update-body", "When leasing sync-pr, include --update-body in the returned command."],
    ["--yes", "Required before leased commands are executed."],
    ...repositoryOptions,
    ...projectOptions,
  ],
})

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const holder = requiredString(args.holder, "holder")
const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })
const config = readControlPlaneConfig()

if (!args.yes) {
  fail("control-plane-loop executes leased queue mutations; rerun with --yes")
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
  console.log(`agent-runner control-plane loop: iteration ${iteration}/${loopOptions.iterations}`)

  const snapshot = generateControlPlaneTickSnapshot(args, { repoRoot })
  const submitted = await submitTickSnapshot({
    snapshot,
    token: config.token,
    url: config.url,
  }).catch((error) => {
    fail(error instanceof Error ? error.message : String(error))
  })

  const leaseResult = await requestLatestDispatchIntent({
    request: buildLatestDispatchIntentRequest({
      action: args.action,
      ciRepairCommand: args.ciRepairCommand,
      eventLog: args.eventLog,
      holder,
      issue: args.issue,
      repository,
      ttlSeconds: args.ttlSeconds,
      updateBody: args.updateBody,
    }),
    token: config.token,
    url: config.url,
  }).catch((error) => {
    fail(error instanceof Error ? error.message : String(error))
  })

  tryAppendAgentRunnerEvent({
    eventLogPath,
    event: {
      type: "control-plane-loop.iteration.snapshot_submitted",
      dispatchableRecommendationCount: submitted.summary?.dispatchableRecommendationCount,
      iteration,
      iterations: loopOptions.iterations,
      recommendationCount: submitted.summary?.recommendationCount,
      repository,
    },
  })

  if (!leaseResult.intent) {
    console.log(`agent-runner control-plane loop: idle (${leaseResult.reason})`)
    tryAppendAgentRunnerEvent({
      eventLogPath,
      event: {
        type: "control-plane-loop.iteration.idle",
        iteration,
        iterations: loopOptions.iterations,
        reason: leaseResult.reason,
        repository,
      },
    })
    break
  }

  let result
  try {
    result = await runLeasedDispatchIntent({
      config,
      eventLogPath,
      finishDispatchIntent,
      holder,
      intent: leaseResult.intent,
      repository,
      requestLatestDispatchIntentResult: leaseResult,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    fail(message)
  }

  if (
    !shouldContinueLoop({ iteration, iterations: loopOptions.iterations, status: result.status })
  ) {
    process.exitCode = result.status
    break
  }

  if (loopOptions.sleepMs > 0) {
    await sleep(loopOptions.sleepMs)
  }
}

function readControlPlaneConfig() {
  try {
    return controlPlaneConfigFromArgs(args)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`missing required --${name}`)
  }
  return value.trim()
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

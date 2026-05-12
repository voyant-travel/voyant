import { currentRepositoryFromOrigin, fail, parseArgs, runGit } from "./lib/agent-project-queue.mjs"
import {
  controlPlaneConfigFromArgs,
  finishDispatchIntent,
  requestLatestDispatchIntent,
} from "./lib/agent-runner-control-plane.mjs"
import {
  dispatchableActions,
  dispatchIntentCommandArgs,
  runDispatchIntentCommand,
} from "./lib/agent-runner-dispatch.mjs"
import {
  issueEventDetails,
  resolveEventLogPath,
  tryAppendAgentRunnerEvent,
} from "./lib/agent-runner-events.mjs"
import { eventLogOptions, maybePrintHelp, repositoryOptions } from "./lib/agent-runner-help.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:run-dispatch-intent",
  summary: "Lease one control-plane dispatch intent, run it, and report the terminal outcome.",
  usage: "pnpm agent:queue:run-dispatch-intent -- --holder <id> --yes [--repo <owner/name>]",
  options: [
    ["--control-plane-url <url>", "Control-plane base URL. Defaults to AGENT_CONTROL_PLANE_URL."],
    ["AGENT_CONTROL_PLANE_TOKEN", "Bearer token environment variable used for API routes."],
    ["--holder <id>", "Supervisor or runner identifier recorded on the lease."],
    ["--ttl-seconds <number>", "Lease TTL in seconds, 60..3600. Defaults to 900."],
    ["--issue <number>", "Only lease a recommendation for this issue number."],
    [
      "--action <name>",
      `Only lease this action. Allowed: ${Array.from(dispatchableActions).join(", ")}.`,
    ],
    ...eventLogOptions,
    ["--update-body", "When leasing sync-pr, include --update-body in the returned command."],
    ["--json", "Print machine-readable JSON after finishing the intent."],
    ["--yes", "Required before the leased command is executed."],
    ...repositoryOptions,
  ],
})

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const holder = requiredString(args.holder, "holder")
const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })

if (!args.yes) {
  fail("run-dispatch-intent executes one leased queue mutation; rerun with --yes")
}

if (args.action && !dispatchableActions.has(args.action)) {
  fail(`action ${args.action} is not dispatchable`)
}

const issueNumber = optionalPositiveInteger(args.issue, "issue")
const ttlSeconds = optionalInteger(args.ttlSeconds, "ttl-seconds", { max: 3600, min: 60 })
const config = readControlPlaneConfig()
const request = {
  repository,
  lease: {
    holder,
    ...(ttlSeconds ? { ttlSeconds } : {}),
  },
  ...(issueNumber || args.action
    ? {
        filters: {
          ...(args.action ? { action: args.action } : {}),
          ...(issueNumber ? { issueNumber } : {}),
        },
      }
    : {}),
  ...(args.eventLog || args.updateBody
    ? {
        options: {
          ...(args.eventLog ? { eventLog: args.eventLog } : {}),
          ...(args.updateBody ? { updateBody: true } : {}),
        },
      }
    : {}),
}

let leaseResult
try {
  leaseResult = await requestLatestDispatchIntent({
    request,
    token: config.token,
    url: config.url,
  })
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

if (!leaseResult.intent) {
  if (args.json) {
    console.log(JSON.stringify(leaseResult, null, 2))
  } else {
    console.log(`dispatch intent: none (${leaseResult.reason})`)
  }
  process.exit(0)
}

const intent = leaseResult.intent
let commandArgs
let finishResult
let status = 1
let terminalStatus = "failed"
let terminalReason = "command failed"

try {
  commandArgs = dispatchIntentCommandArgs(intent)
  printIntent({ commandArgs, controlPlaneUrl: config.url, intent })
  tryAppendAgentRunnerEvent({
    eventLogPath,
    event: {
      type: "dispatch-intent.started",
      command: ["pnpm", ...commandArgs],
      intent: intentEventDetails(intent),
      issue: issueEventDetails(intent.plan),
      repository,
    },
  })
  status = runDispatchIntentCommand(intent) ?? 1
  terminalStatus = status === 0 ? "completed" : "failed"
  terminalReason = status === 0 ? "command completed" : `command exited with status ${status}`
} catch (error) {
  terminalStatus = "failed"
  terminalReason = error instanceof Error ? error.message : String(error)
  console.error(`dispatch intent failed before completion: ${terminalReason}`)
}

try {
  finishResult = await finishDispatchIntent({
    id: intent.id,
    request: {
      exitCode: status,
      holder,
      reason: terminalReason,
      status: terminalStatus,
    },
    token: config.token,
    url: config.url,
  })
  tryAppendAgentRunnerEvent({
    eventLogPath,
    event: {
      type: "dispatch-intent.finished",
      intent: intentEventDetails(finishResult.intent),
      issue: issueEventDetails(intent.plan),
      repository,
      status,
      terminalStatus,
    },
  })
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  tryAppendAgentRunnerEvent({
    eventLogPath,
    event: {
      type: "dispatch-intent.finish_failed",
      error: message,
      intent: intentEventDetails(intent),
      issue: issueEventDetails(intent.plan),
      repository,
      status,
      terminalStatus,
    },
  })
  fail(message)
}

if (args.json) {
  console.log(
    JSON.stringify(
      {
        finish: finishResult,
        lease: leaseResult,
        status,
      },
      null,
      2,
    ),
  )
} else {
  console.log(`dispatch intent ${intent.id}: ${terminalStatus}`)
}

process.exitCode = status

function printIntent({ commandArgs, controlPlaneUrl, intent }) {
  console.log("agent-runner dispatch intent")
  console.log(`control plane: ${controlPlaneUrl}`)
  console.log(`intent: ${intent.id}`)
  console.log(`holder: ${intent.lease.holder}`)
  console.log(`issue: #${intent.plan.issue.number} ${intent.plan.issue.title}`)
  console.log(`action: ${intent.plan.action}`)
  console.log(`command: pnpm ${commandArgs.join(" ")}`)
}

function intentEventDetails(intent) {
  return {
    action: intent.plan.action,
    holder: intent.lease.holder,
    id: intent.id,
    status: intent.status,
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

function optionalPositiveInteger(value, name) {
  return optionalInteger(value, name, { min: 1 })
}

function optionalInteger(value, name, { max = Number.POSITIVE_INFINITY, min = 1 } = {}) {
  if (value === undefined) return undefined

  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    fail(`invalid ${name}: ${value}`)
  }
  return number
}

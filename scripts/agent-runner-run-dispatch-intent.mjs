import { currentRepositoryFromOrigin, fail, parseArgs, runGit } from "./lib/agent-project-queue.mjs"
import {
  controlPlaneConfigFromArgs,
  finishDispatchIntent,
  requestLatestDispatchIntent,
} from "./lib/agent-runner-control-plane.mjs"
import { buildLatestDispatchIntentRequest } from "./lib/agent-runner-control-plane-tick.mjs"
import { dispatchableActions } from "./lib/agent-runner-dispatch.mjs"
import { runLeasedDispatchIntent } from "./lib/agent-runner-dispatch-intent-runner.mjs"
import { resolveEventLogPath } from "./lib/agent-runner-events.mjs"
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
    ["--implementation-command <shell>", "Command used when leasing local run-command items."],
    [
      "--remote-implementation-command <shell>",
      "Command used when leasing remote-run-command items. Defaults to --implementation-command.",
    ],
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
const request = buildLatestDispatchIntentRequest({
  action: args.action,
  eventLog: args.eventLog,
  holder,
  implementationCommand: args.implementationCommand,
  issue: issueNumber,
  remoteImplementationCommand: args.remoteImplementationCommand ?? args.implementationCommand,
  repository,
  ttlSeconds,
  updateBody: args.updateBody,
})

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
let finishResult
let status = 1
let terminalStatus = "failed"

try {
  const result = await runLeasedDispatchIntent({
    config,
    eventLogPath,
    finishDispatchIntent,
    holder,
    intent,
    repository,
    requestLatestDispatchIntentResult: leaseResult,
  })
  finishResult = result.finish
  status = result.status
  terminalStatus = result.terminalStatus
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
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

import { currentRepositoryFromOrigin, fail, parseArgs, runGit } from "./lib/agent-project-queue.mjs"
import {
  controlPlaneConfigFromArgs,
  requestLatestDispatchIntent,
} from "./lib/agent-runner-control-plane.mjs"
import { dispatchableActions } from "./lib/agent-runner-dispatch.mjs"
import { eventLogOptions, maybePrintHelp, repositoryOptions } from "./lib/agent-runner-help.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:lease-dispatch",
  summary: "Lease the next dispatch intent from the control plane's latest stored tick snapshot.",
  usage: "pnpm agent:queue:lease-dispatch -- --holder <id> [--repo <owner/name>] [--json]",
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
    ["--json", "Print machine-readable JSON."],
    ...repositoryOptions,
  ],
})

const repository =
  args.repo ?? currentRepositoryFromOrigin(runGit(["rev-parse", "--show-toplevel"]))
const holder = requiredString(args.holder, "holder")

if (args.action && !dispatchableActions.has(args.action)) {
  fail(`action ${args.action} is not dispatchable`)
}

const issueNumber = optionalPositiveInteger(args.issue, "issue")
const ttlSeconds = optionalInteger(args.ttlSeconds, "ttl-seconds", { max: 3600, min: 60 })
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
const config = readControlPlaneConfig()

try {
  const result = await requestLatestDispatchIntent({
    request,
    token: config.token,
    url: config.url,
  })

  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    printIntent({ controlPlaneUrl: config.url, result })
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

function printIntent({ controlPlaneUrl, result }) {
  console.log("agent-runner latest dispatch intent")
  console.log(`control plane: ${controlPlaneUrl}`)
  console.log(`repository: ${result.source?.repository ?? repository}`)
  if (result.source?.acceptedAt) {
    console.log(`snapshot accepted: ${result.source.acceptedAt}`)
  }

  if (!result.intent) {
    console.log(`intent: none (${result.reason})`)
    return
  }

  console.log(`intent: ${result.intent.id}`)
  console.log(`holder: ${result.intent.lease.holder}`)
  console.log(`lease expires: ${result.intent.lease.expiresAt}`)
  console.log(`issue: #${result.intent.plan.issue.number} ${result.intent.plan.issue.title}`)
  console.log(`action: ${result.intent.plan.action}`)
  console.log(`reason: ${result.intent.plan.reason}`)
  console.log(`command: ${result.intent.plan.command.join(" ")}`)
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

import { fail, parseArgs } from "./lib/agent-project-queue.mjs"
import {
  controlPlaneConfigFromArgs,
  finishDispatchIntent,
} from "./lib/agent-runner-control-plane.mjs"
import { maybePrintHelp } from "./lib/agent-runner-help.mjs"

const terminalStatuses = new Set(["completed", "failed", "released"])

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:finish-dispatch",
  summary: "Mark a leased dispatch intent as completed, failed, or released.",
  usage:
    "pnpm agent:queue:finish-dispatch -- --intent <id> --holder <id> --status <completed|failed|released>",
  options: [
    ["--control-plane-url <url>", "Control-plane base URL. Defaults to AGENT_CONTROL_PLANE_URL."],
    ["AGENT_CONTROL_PLANE_TOKEN", "Bearer token environment variable used for API routes."],
    ["--intent <id>", "Dispatch intent id returned by agent:queue:lease-dispatch."],
    ["--holder <id>", "Lease holder recorded on the dispatch intent."],
    ["--status <name>", "Terminal status: completed, failed, or released."],
    ["--reason <text>", "Optional completion note for audit context."],
    ["--exit-code <number>", "Optional process exit code for completed or failed commands."],
    ["--json", "Print machine-readable JSON."],
  ],
})

const id = requiredString(args.intent, "intent")
const holder = requiredString(args.holder, "holder")
const status = requiredString(args.status, "status")
if (!terminalStatuses.has(status)) {
  fail(`invalid status: ${status}`)
}

const exitCode = optionalInteger(args.exitCode, "exit-code")
const request = {
  holder,
  status,
  ...(args.reason ? { reason: String(args.reason).trim() } : {}),
  ...(exitCode === undefined ? {} : { exitCode }),
}
const config = readControlPlaneConfig()

try {
  const result = await finishDispatchIntent({
    id,
    request,
    token: config.token,
    url: config.url,
  })

  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    printResult({ controlPlaneUrl: config.url, result })
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

function printResult({ controlPlaneUrl, result }) {
  console.log("agent-runner dispatch intent finish")
  console.log(`control plane: ${controlPlaneUrl}`)
  console.log(`intent: ${result.intent.id}`)
  console.log(`status: ${result.intent.status}`)
  console.log(`holder: ${result.intent.resolution?.holder ?? result.intent.lease.holder}`)
  if (result.intent.resolution?.finishedAt) {
    console.log(`finished: ${result.intent.resolution.finishedAt}`)
  }
  if (result.intent.resolution?.reason) {
    console.log(`reason: ${result.intent.resolution.reason}`)
  }
  console.log(`active updated: ${result.storage.activeUpdated ? "yes" : "no"}`)
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

function optionalInteger(value, name) {
  if (value === undefined) return undefined

  const number = Number(value)
  if (!Number.isInteger(number)) {
    fail(`invalid ${name}: ${value}`)
  }
  return number
}

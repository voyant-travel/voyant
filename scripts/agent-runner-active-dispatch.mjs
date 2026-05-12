import { currentRepositoryFromOrigin, fail, parseArgs, runGit } from "./lib/agent-project-queue.mjs"
import {
  controlPlaneConfigFromArgs,
  requestActiveDispatchIntent,
} from "./lib/agent-runner-control-plane.mjs"
import { dispatchableActions } from "./lib/agent-runner-dispatch.mjs"
import { maybePrintHelp, repositoryOptions } from "./lib/agent-runner-help.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:active-dispatch",
  summary: "Read the active dispatch intent for one repository, issue, and lifecycle action.",
  usage:
    "pnpm agent:queue:active-dispatch -- --issue <number> --action <name> [--repo <owner/name>] [--json]",
  options: [
    ["--control-plane-url <url>", "Control-plane base URL. Defaults to AGENT_CONTROL_PLANE_URL."],
    ["AGENT_CONTROL_PLANE_TOKEN", "Bearer token environment variable used for API routes."],
    ["--issue <number>", "Issue number for the active intent reference."],
    [
      "--action <name>",
      `Dispatch lifecycle action. Allowed: ${Array.from(dispatchableActions).join(", ")}.`,
    ],
    ["--json", "Print machine-readable JSON."],
    ...repositoryOptions,
  ],
})

const repository =
  args.repo ?? currentRepositoryFromOrigin(runGit(["rev-parse", "--show-toplevel"]))
const issueNumber = requiredPositiveInteger(args.issue, "issue")
const action = requiredAction(args.action)
const config = readControlPlaneConfig()

try {
  const result = await requestActiveDispatchIntent({
    request: {
      action,
      issueNumber,
      repository,
    },
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
  console.log("agent-runner active dispatch intent")
  console.log(`control plane: ${controlPlaneUrl}`)
  console.log(`repository: ${result.intent.plan.repository}`)
  console.log(`issue: #${result.intent.plan.issue.number} ${result.intent.plan.issue.title}`)
  console.log(`action: ${result.intent.plan.action}`)
  console.log(`intent: ${result.intent.id}`)
  console.log(`status: ${result.intent.status}`)
  console.log(`active: ${result.active ? "yes" : "no"}`)
  console.log(`holder: ${result.intent.lease.holder}`)
  console.log(`lease expires: ${result.intent.lease.expiresAt}`)
}

function readControlPlaneConfig() {
  try {
    return controlPlaneConfigFromArgs(args)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

function requiredAction(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail("missing required --action")
  }

  const action = value.trim()
  if (!dispatchableActions.has(action)) {
    fail(`action ${action} is not dispatchable`)
  }
  return action
}

function requiredPositiveInteger(value, name) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) {
    fail(`invalid ${name}: ${value ?? ""}`)
  }
  return number
}

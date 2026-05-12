import { currentRepositoryFromOrigin, fail, parseArgs, runGit } from "./lib/agent-project-queue.mjs"
import {
  controlPlaneConfigFromArgs,
  requestLatestDispatchPlan,
} from "./lib/agent-runner-control-plane.mjs"
import { dispatchableActions } from "./lib/agent-runner-dispatch.mjs"
import { eventLogOptions, maybePrintHelp, repositoryOptions } from "./lib/agent-runner-help.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:plan-dispatch",
  summary: "Request the next dispatch plan from the control plane's latest stored tick snapshot.",
  usage: "pnpm agent:queue:plan-dispatch -- [--repo <owner/name>] [--json]",
  options: [
    ["--control-plane-url <url>", "Control-plane base URL. Defaults to AGENT_CONTROL_PLANE_URL."],
    ["AGENT_CONTROL_PLANE_TOKEN", "Bearer token environment variable used for API routes."],
    ["--issue <number>", "Only plan a recommendation for this issue number."],
    [
      "--action <name>",
      `Only plan this action. Allowed: ${Array.from(dispatchableActions).join(", ")}.`,
    ],
    ...eventLogOptions,
    ["--update-body", "When planning sync-pr, include --update-body in the returned command."],
    ["--json", "Print machine-readable JSON."],
    ...repositoryOptions,
  ],
})

const repository =
  args.repo ?? currentRepositoryFromOrigin(runGit(["rev-parse", "--show-toplevel"]))

if (args.action && !dispatchableActions.has(args.action)) {
  fail(`action ${args.action} is not dispatchable`)
}

const issueNumber = optionalPositiveInteger(args.issue, "issue")
const request = {
  repository,
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
  const result = await requestLatestDispatchPlan({
    request,
    token: config.token,
    url: config.url,
  })

  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    printPlan({ controlPlaneUrl: config.url, result })
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

function printPlan({ controlPlaneUrl, result }) {
  console.log("agent-runner latest dispatch plan")
  console.log(`control plane: ${controlPlaneUrl}`)
  console.log(`repository: ${result.source?.repository ?? repository}`)
  if (result.source?.acceptedAt) {
    console.log(`snapshot accepted: ${result.source.acceptedAt}`)
  }
  if (Number.isInteger(result.source?.recommendationCount)) {
    console.log(`snapshot recommendations: ${result.source.recommendationCount}`)
  }

  if (!result.plan) {
    console.log(`plan: none (${result.reason})`)
    return
  }

  console.log(`issue: #${result.plan.issue.number} ${result.plan.issue.title}`)
  console.log(`action: ${result.plan.action}`)
  console.log(`reason: ${result.plan.reason}`)
  console.log(`command: ${result.plan.command.join(" ")}`)
}

function readControlPlaneConfig() {
  try {
    return controlPlaneConfigFromArgs(args)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

function optionalPositiveInteger(value, name) {
  if (value === undefined) return undefined

  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) {
    fail(`invalid ${name}: ${value}`)
  }
  return number
}

import { currentRepositoryFromOrigin, fail, parseArgs, runGit } from "./lib/agent-project-queue.mjs"
import {
  controlPlaneConfigFromArgs,
  finishDispatchIntent,
  requestActiveDispatchIntent,
} from "./lib/agent-runner-control-plane.mjs"
import { dispatchableActions } from "./lib/agent-runner-dispatch.mjs"
import { planDispatchIntentRelease } from "./lib/agent-runner-dispatch-release.mjs"
import { maybePrintHelp, repositoryOptions } from "./lib/agent-runner-help.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:release-dispatch",
  summary: "Release an expired active dispatch intent by repository, issue, and action.",
  usage:
    "pnpm agent:queue:release-dispatch -- --issue <number> --action <name> [--repo <owner/name>] [--force] [--json]",
  options: [
    ["--control-plane-url <url>", "Control-plane base URL. Defaults to AGENT_CONTROL_PLANE_URL."],
    ["AGENT_CONTROL_PLANE_TOKEN", "Bearer token environment variable used for API routes."],
    ["--issue <number>", "Issue number for the active intent reference."],
    [
      "--action <name>",
      `Dispatch lifecycle action. Allowed: ${Array.from(dispatchableActions).join(", ")}.`,
    ],
    ["--reason <text>", "Optional release note for audit context."],
    ["--force", "Release even when the active lease has not expired."],
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
  const active = await requestActiveDispatchIntent({
    request: {
      action,
      issueNumber,
      repository,
    },
    token: config.token,
    url: config.url,
  })
  const releasePlan = planDispatchIntentRelease({
    activeResult: active,
    force: Boolean(args.force),
    now: new Date(),
    ...(args.reason ? { reason: String(args.reason) } : {}),
  })

  if (!releasePlan.release) {
    const result = {
      active,
      reason: releasePlan.reason,
      released: false,
    }
    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      printSkipped({ active, controlPlaneUrl: config.url, reason: releasePlan.reason })
    }
    process.exitCode = 1
  } else {
    const finish = await finishDispatchIntent({
      id: releasePlan.id,
      request: releasePlan.request,
      token: config.token,
      url: config.url,
    })
    const result = {
      active,
      finish,
      released: true,
    }
    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      printReleased({ controlPlaneUrl: config.url, finish })
    }
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

function printReleased({ controlPlaneUrl, finish }) {
  console.log("agent-runner dispatch intent release")
  console.log(`control plane: ${controlPlaneUrl}`)
  console.log(`intent: ${finish.intent.id}`)
  console.log(`status: ${finish.intent.status}`)
  console.log(`holder: ${finish.intent.resolution?.holder ?? finish.intent.lease.holder}`)
  if (finish.intent.resolution?.finishedAt) {
    console.log(`finished: ${finish.intent.resolution.finishedAt}`)
  }
  if (finish.intent.resolution?.reason) {
    console.log(`reason: ${finish.intent.resolution.reason}`)
  }
  console.log(`active updated: ${finish.storage.activeUpdated ? "yes" : "no"}`)
}

function printSkipped({ active, controlPlaneUrl, reason }) {
  console.log("agent-runner dispatch intent release")
  console.log(`control plane: ${controlPlaneUrl}`)
  console.log(`intent: ${active.intent.id}`)
  console.log(`status: ${active.intent.status}`)
  console.log(`active: ${active.active ? "yes" : "no"}`)
  console.log(`holder: ${active.intent.lease.holder}`)
  console.log(`lease expires: ${active.intent.lease.expiresAt}`)
  console.log(`release skipped: ${reason}`)
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

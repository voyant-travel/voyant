import { fail, parseArgs, runGit } from "./lib/agent-project-queue.mjs"
import {
  controlPlaneConfigFromArgs,
  submitTickSnapshot,
} from "./lib/agent-runner-control-plane.mjs"
import {
  generateControlPlaneTickSnapshot,
  readControlPlaneTickSnapshotInput,
} from "./lib/agent-runner-control-plane-tick.mjs"
import {
  eventLogOptions,
  maybePrintHelp,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:submit-tick",
  summary: "Submit a queue tick snapshot to the agent control plane without dispatching work.",
  usage: "pnpm agent:queue:submit-tick -- [--input <path|->] [--control-plane-url <url>]",
  options: [
    ["--input <path|->", "Submit an existing tick JSON file, or read JSON from stdin with '-'."],
    ["--control-plane-url <url>", "Control-plane base URL. Defaults to AGENT_CONTROL_PLANE_URL."],
    ["AGENT_CONTROL_PLANE_TOKEN", "Bearer token environment variable used for API routes."],
    [
      "--max-age-days <number>",
      "Heartbeat staleness threshold when generating a snapshot. Defaults to 1.",
    ],
    ["--recent-events <number>", "Number of recent runner events to include. Defaults to 5."],
    ...eventLogOptions,
    ...repositoryOptions,
    ...projectOptions,
  ],
})

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const snapshot = args.input
  ? readControlPlaneTickSnapshotInput(args.input)
  : generateControlPlaneTickSnapshot(args, { repoRoot })
const config = readControlPlaneConfig()

try {
  const result = await submitTickSnapshot({
    snapshot,
    token: config.token,
    url: config.url,
  })

  console.log("agent-runner submitted tick snapshot")
  console.log(`control plane: ${config.url}`)
  console.log(`repository: ${result.snapshot?.repository ?? snapshot.repository}`)
  console.log(`recommendations: ${result.summary?.recommendationCount ?? "unknown"}`)
  console.log(`dispatchable: ${result.summary?.dispatchableRecommendationCount ?? "unknown"}`)
  if (result.summary?.firstDispatchableIssueNumber) {
    console.log(
      `first dispatchable: #${result.summary.firstDispatchableIssueNumber} ${result.summary.firstDispatchableAction}`,
    )
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

function readControlPlaneConfig() {
  try {
    return controlPlaneConfigFromArgs(args)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

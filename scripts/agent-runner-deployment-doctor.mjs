import { parseArgs } from "./lib/agent-project-queue.mjs"
import {
  controlPlaneConfigFromArgs,
  requestControlPlaneCapabilities,
} from "./lib/agent-runner-control-plane.mjs"
import {
  requestRunnerAppCapabilities,
  runnerAppConfigFromArgs,
  summarizeControlPlaneCapabilities,
  summarizeRunnerAppCapabilities,
} from "./lib/agent-runner-deployment-doctor.mjs"
import { maybePrintHelp } from "./lib/agent-runner-help.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:deployment-doctor",
  summary: "Check deployed control-plane and runner app capability endpoints.",
  usage: "pnpm agent:queue:deployment-doctor -- [--json]",
  options: [
    ["--control-plane-url <url>", "Control-plane base URL. Defaults to AGENT_CONTROL_PLANE_URL."],
    ["AGENT_CONTROL_PLANE_TOKEN", "Bearer token environment variable used for control-plane APIs."],
    ["--runner-url <url>", "Runner app base URL. Defaults to AGENT_RUNNER_URL."],
    ["--runner-token <token>", "Runner app bearer token. Defaults to AGENT_RUNNER_TOKEN."],
    ["--json", "Print machine-readable JSON."],
  ],
})

const checks = []

await checkControlPlane()
await checkRunnerApp()

const ok = checks.every((check) => check.ok)
if (args.json) {
  console.log(JSON.stringify({ checks, ok }, null, 2))
} else {
  printHumanSummary({ checks, ok })
}

process.exitCode = ok ? 0 : 1

async function checkControlPlane() {
  let config
  try {
    config = controlPlaneConfigFromArgs(args)
  } catch (error) {
    record({
      detail: error instanceof Error ? error.message : String(error),
      name: "control plane configuration",
      ok: false,
    })
    return
  }

  record({
    detail: `Using ${config.url}; token configured.`,
    name: "control plane configuration",
    ok: true,
  })

  try {
    const capabilities = await requestControlPlaneCapabilities(config)
    record({
      name: "control plane capabilities",
      ...summarizeControlPlaneCapabilities(capabilities),
    })
  } catch (error) {
    record({
      detail: error instanceof Error ? error.message : String(error),
      name: "control plane capabilities",
      ok: false,
    })
  }
}

async function checkRunnerApp() {
  let config
  try {
    config = runnerAppConfigFromArgs(args)
  } catch (error) {
    record({
      detail: error instanceof Error ? error.message : String(error),
      name: "runner app configuration",
      ok: false,
    })
    return
  }

  record({
    detail: `Using ${config.url}; token configured.`,
    name: "runner app configuration",
    ok: true,
  })

  try {
    const capabilities = await requestRunnerAppCapabilities(config)
    record({
      name: "runner app capabilities",
      ...summarizeRunnerAppCapabilities(capabilities),
    })
  } catch (error) {
    record({
      detail: error instanceof Error ? error.message : String(error),
      name: "runner app capabilities",
      ok: false,
    })
  }
}

function record(check) {
  checks.push(check)
}

function printHumanSummary({ checks, ok }) {
  console.log(`agent-runner deployment doctor: ${ok ? "OK" : "FAILED"}`)
  console.log("")
  for (const check of checks) {
    console.log(`${check.ok ? "OK" : "FAIL"} ${check.name}`)
    console.log(`  ${check.detail}`)
  }
}

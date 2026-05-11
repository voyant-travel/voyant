import { spawn } from "node:child_process"
import { createWriteStream, existsSync, mkdirSync } from "node:fs"
import path from "node:path"

import {
  currentRepositoryFromOrigin,
  fail,
  findProjectIssueItem,
  loadAllEvaluatedProject,
  parseArgs,
  projectScanConfigFromArgs,
  runGit,
} from "./lib/agent-project-queue.mjs"
import {
  browserArtifactPlan,
  browserCapturePlan,
  browserCapturePlans,
  browserEvidenceEnvironment,
  browserEvidenceText,
  captureBrowserEvidence,
  captureBrowserEvidenceSet,
  requiresBrowserEvidence,
} from "./lib/agent-runner-browser-evidence.mjs"
import {
  maybePrintHelp,
  mutationOptions,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:capture-browser",
  summary: "Capture browser evidence for a claimed UI task workspace.",
  usage: 'pnpm agent:queue:capture-browser -- --issue <number> --url "http://127.0.0.1:4879" --yes',
  options: [
    ["--issue <number>", "Issue number whose workspace should receive browser artifacts."],
    ["--url <url>", "URL to capture. Defaults to the issue-scoped local dev server URL."],
    ["--dev-server-command <shell>", "Optional dev server command to start before capture."],
    ["--workspace <path>", "Workspace path override."],
    ["--viewport <size>", "Single viewport as <width>x<height>. Defaults to 1440x900."],
    ["--viewports <sizes>", "Comma-separated viewport list, for example 1440x900,390x844."],
    ["--timeout-ms <number>", "Navigation and dev-server wait timeout. Defaults to 30000."],
    ["--screenshot-name <name>", "Screenshot file name. Defaults to page.png."],
    ["--browser-base-port <number>", "Base port for deterministic issue ports. Defaults to 4300."],
    ...repositoryOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("capture-browser mode requires --issue <number>")
}

const timeoutMs = numberArg(args.timeoutMs, 30_000, "timeout-ms")
const browserBasePort = numberArg(args.browserBasePort, 4300, "browser-base-port")
if (args.viewport && args.viewports) {
  fail("use either --viewport or --viewports, not both")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const item = findProjectIssueItem(project.items, {
  issueNumber: args.issue,
  repository,
})

if (item.issue.state !== "OPEN") {
  fail(
    `issue #${args.issue} cannot capture browser evidence because issue state is ${item.issue.state}`,
  )
}

const workspaceReference = args.workspace ?? item.fields.Workspace ?? item.dryRunPlan.workspace
const artifactPlan = browserArtifactPlan({
  basePort: browserBasePort,
  item,
  repoRoot,
  workspaceReference,
})
const capturePlan = browserCapturePlan({
  artifactPlan,
  screenshotName: args.screenshotName,
  url: args.url ?? artifactPlan.devServerUrl,
  viewport: args.viewport,
})
const capturePlans = args.viewports
  ? browserCapturePlans({
      artifactPlan,
      screenshotName: args.screenshotName,
      url: args.url ?? artifactPlan.devServerUrl,
      viewports: args.viewports,
    })
  : [capturePlan]

if (!artifactPlan.safeArtifactPath) {
  fail(`capture-browser refuses artifacts outside the workspace: ${artifactPlan.artifactDir}`)
}

if (!existsSync(artifactPlan.workspace)) {
  fail(`workspace does not exist: ${artifactPlan.workspace}`)
}

if (!args.yes) {
  printCapturePlan({ artifactPlan, item, repository })
  fail("capture-browser mode writes local browser artifacts; rerun with --yes")
}

const { chromium } = await import("playwright").catch((error) => {
  fail(`Playwright is not available: ${error.message}`)
})

mkdirSync(artifactPlan.artifactDir, { recursive: true })
const server = args.devServerCommand
  ? startDevServer({
      artifactPlan,
      command: args.devServerCommand,
      env: browserEvidenceEnvironment({ artifactPlan }),
    })
  : undefined
let result
let captureError

try {
  if (server) {
    await waitForUrl(capturePlans[0].url, { timeoutMs })
  }

  result =
    capturePlans.length === 1
      ? await captureBrowserEvidence({
          browserLauncher: chromium,
          capturePlan: capturePlans[0],
          timeoutMs,
        })
      : await captureBrowserEvidenceSet({
          browserLauncher: chromium,
          capturePlans,
          timeoutMs,
        })
} catch (error) {
  captureError = error
} finally {
  await stopDevServer(server)
}

if (captureError) {
  fail(`capture-browser failed: ${captureError.message}`)
}

console.log("agent-runner capture-browser: wrote browser evidence")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`workspace: ${artifactPlan.workspace}`)
console.log(`artifacts: ${artifactPlan.artifactDir}`)
console.log("")
console.log("Use this value with --ui-evidence:")
console.log(browserEvidenceText(result))

if (!requiresBrowserEvidence(item)) {
  console.log("")
  console.log("Note: browser evidence is not required by this issue's labels.")
}

function printCapturePlan({ artifactPlan, item, repository }) {
  console.log("agent-runner capture-browser would capture:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`workspace: ${artifactPlan.workspace}`)
  console.log(`url: ${capturePlans[0].url}`)
  console.log(`viewports: ${capturePlans.map((plan) => viewportLabel(plan.viewport)).join(", ")}`)
  console.log(`artifacts: ${artifactPlan.artifactDir}`)
  for (const plan of capturePlans) {
    console.log(`screenshot ${viewportLabel(plan.viewport)}: ${plan.screenshotFile}`)
  }
  console.log(`console log: ${artifactPlan.consoleLog}`)
  console.log(`failed-request log: ${artifactPlan.networkLog}`)
  if (args.devServerCommand) {
    console.log(`dev server command: ${args.devServerCommand}`)
  }
}

function viewportLabel(viewport) {
  return `${viewport.width}x${viewport.height}`
}

function startDevServer({ artifactPlan, command, env }) {
  const logFile = path.join(artifactPlan.artifactDir, "dev-server.log")
  const logStream = createWriteStream(logFile, { flags: "a" })
  logStream.write(`# ${new Date().toISOString()} ${command}\n\n`)
  let exited = false

  const child = spawn(command, {
    cwd: artifactPlan.workspace,
    env: {
      ...process.env,
      ...env,
    },
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  })

  child.stdout.pipe(logStream, { end: false })
  child.stderr.pipe(logStream, { end: false })
  child.once("exit", () => {
    exited = true
  })

  return { child, exited: () => exited, logStream }
}

async function waitForUrl(url, { timeoutMs }) {
  const startedAt = Date.now()
  let lastError

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" })
      if (response.status < 500) return
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  fail(`timed out waiting for ${url}: ${lastError?.message ?? "no response"}`)
}

async function stopDevServer(server) {
  if (!server) return

  const { child, logStream } = server
  if (!server.exited() && !child.killed) {
    child.kill("SIGTERM")
  }

  if (!server.exited()) {
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 2_000)
      child.once("exit", () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  await new Promise((resolve) => logStream.end(resolve))
}

function numberArg(value, fallback, name) {
  if (value === undefined) return fallback

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    fail(`invalid ${name}: ${value}`)
  }

  return parsed
}

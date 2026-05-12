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
  artifactPublicationPlan,
  artifactPublisherFromEnv,
  publishArtifactDirectory,
} from "./lib/agent-runner-artifacts.mjs"
import {
  browserCapturePlan,
  browserCapturePlans,
  browserEvidenceText,
  captureBrowserEvidence,
  captureBrowserEvidenceSet,
  requiresBrowserEvidence,
  writeBrowserEvidenceSummary,
} from "./lib/agent-runner-browser-evidence.mjs"
import { browserIssueBlockReason } from "./lib/agent-runner-browser-issues.mjs"
import {
  issueEventDetails,
  resolveEventLogPath,
  tryAppendAgentRunnerEvent,
} from "./lib/agent-runner-events.mjs"
import {
  eventLogOptions,
  maybePrintHelp,
  mutationOptions,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"
import {
  normalizeRemoteHttpExposure,
  remoteBrowserArtifactPlan,
  waitForRemoteHttpReady,
} from "./lib/agent-runner-remote-browser.mjs"
import { remoteWriteFileShell } from "./lib/agent-runner-remote-execution.mjs"
import {
  remoteProcessMetadata,
  remoteProcessPlan,
  remoteStartProcessShell,
  remoteStopProcessShell,
} from "./lib/agent-runner-remote-process.mjs"
import {
  loadRemoteWorkspaceAdapters,
  resolveRemoteWorkspaceAdapter,
} from "./lib/agent-runner-remote-workspace.mjs"
import {
  isRemoteWorkspaceDescriptor,
  parseWorkspaceReference,
} from "./lib/agent-runner-workspace-contract.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:remote-capture-browser",
  summary: "Expose a remote workspace URL and capture local browser evidence for it.",
  usage:
    'pnpm agent:queue:remote-capture-browser -- --issue <number> --dev-server-command "pnpm dev" --port 3000 --yes',
  options: [
    ["--issue <number>", "Issue number whose remote workspace should receive browser proof."],
    ["--port <number>", "Remote HTTP port to expose through the adapter."],
    ["--url <url>", "Already-exposed URL to capture instead of calling exposeHttp."],
    [
      "--dev-server-command <shell>",
      "Optional remote command to start before capture and stop afterward.",
    ],
    ["--process-name <name>", "Stable remote process name. Defaults from the issue."],
    [
      "--workspace <reference>",
      "Workspace reference override, for example sandbox:sprite:task-579.",
    ],
    ["--viewport <size>", "Single viewport as <width>x<height>. Defaults to 1440x900."],
    ["--viewports <sizes>", "Comma-separated viewport list, for example 1440x900,390x844."],
    [
      "--allow-browser-issues",
      "Allow UI evidence with console errors or failed requests after maintainer review.",
    ],
    ["--timeout-ms <number>", "Navigation timeout. Defaults to 30000."],
    ["--screenshot-name <name>", "Screenshot file name. Defaults to page.png."],
    [
      "--wait-until <event>",
      "Playwright navigation wait event: commit, domcontentloaded, load, or networkidle. Defaults to networkidle.",
    ],
    ["--publish-artifacts", "Upload captured artifacts to configured R2/S3 object storage."],
    [
      "--adapter-config <path>",
      "Optional remote adapter config module. Defaults to .agents/remote-workspaces.mjs when present.",
    ],
    ...repositoryOptions,
    ...eventLogOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("remote-capture-browser mode requires --issue <number>")
}

if (!args.url && !args.port) {
  fail("remote-capture-browser mode requires --url or --port <number>")
}

if (args.devServerCommand && !args.port) {
  fail("remote-capture-browser mode requires --port when --dev-server-command is provided")
}

if (args.viewport && args.viewports) {
  fail("use either --viewport or --viewports, not both")
}

const timeoutMs = numberArg(args.timeoutMs, 30_000, "timeout-ms")
const port = args.port ? numberArg(args.port, undefined, "port") : undefined
const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })
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
const descriptor = parseWorkspaceReference(workspaceReference, { repoRoot })
if (!isRemoteWorkspaceDescriptor(descriptor)) {
  fail(
    `remote-capture-browser requires a remote-sandbox workspace; got ${
      descriptor.kind === "invalid" ? descriptor.reason : descriptor.kind
    }`,
  )
}

const artifactPlan = remoteBrowserArtifactPlan({
  descriptor,
  item,
  repoRoot,
  workspaceReference,
})

if (!artifactPlan.safeArtifactPath) {
  fail(`remote-capture-browser refuses artifacts outside .agent-runs: ${artifactPlan.artifactDir}`)
}

if (!args.yes) {
  printCapturePlan({
    artifactPlan,
    devServerCommand: args.devServerCommand,
    item,
    port,
    processName: args.processName,
    repository,
    url: args.url,
  })
  fail("remote-capture-browser exposes HTTP and writes local artifacts; rerun with --yes")
}

let captureUrl = args.url
let exposure = null
const needsAdapter = Boolean(args.devServerCommand) || !captureUrl
const adapters = needsAdapter ? await loadAdapters({ descriptor, workspaceReference }) : null
const adapter = adapters ? resolveAdapter(descriptor, { adapters }) : null

if (args.devServerCommand && !adapter.capabilities.exec) {
  failInspection(
    new Error(`remote workspace provider ${descriptor.provider} cannot exec commands`),
    { descriptor, workspaceReference },
  )
}

if (!captureUrl) {
  if (!adapter.capabilities.exposeHttp) {
    failInspection(
      new Error(`remote workspace provider ${descriptor.provider} cannot expose HTTP ports`),
      { descriptor, workspaceReference },
    )
  }
}

const processPlan = args.devServerCommand
  ? remoteProcessPlan({
      descriptor,
      item,
      name: args.processName,
      port,
      workspaceReference,
    })
  : null

let processStopResult = null
let result
let runError = null

try {
  if (processPlan) {
    await startRemoteDevServer({ adapter, item, plan: processPlan, repository })
  }

  if (!captureUrl) {
    exposure = normalizeRemoteHttpExposure({
      port,
      result: await adapter.exposeHttp(port),
    })
    captureUrl = exposure.url
  }

  if (processPlan) {
    await waitForRemoteHttpReady(captureUrl, { timeoutMs })
  }

  const capturePlan = browserCapturePlan({
    artifactPlan,
    screenshotName: args.screenshotName,
    url: captureUrl,
    viewport: args.viewport,
    waitUntil: args.waitUntil,
  })
  const capturePlans = args.viewports
    ? browserCapturePlans({
        artifactPlan,
        screenshotName: args.screenshotName,
        url: captureUrl,
        viewports: args.viewports,
        waitUntil: args.waitUntil,
      })
    : [capturePlan]

  const { chromium } = await import("playwright")

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

  if (args.publishArtifacts) {
    const publisher = artifactPublisherFromEnv()
    const publicationPlan = artifactPublicationPlan({
      publisher,
      reference: artifactPlan.artifactPointer,
      repository,
    })
    result = {
      ...result,
      remoteArtifactIndex: publicationPlan.indexUrl,
    }
    writeBrowserEvidenceSummary(artifactPlan, result)
    await publishArtifactDirectory({
      directory: artifactPlan.artifactDir,
      issueNumber: item.issue.number,
      publisher,
      reference: artifactPlan.artifactPointer,
      repository,
    })
  }
} catch (error) {
  runError = error
} finally {
  if (processPlan) {
    processStopResult = await stopRemoteDevServer({ adapter, plan: processPlan })
  }
}

if (runError) {
  const message = runError instanceof Error ? runError.message : String(runError)
  const stopMessage =
    processStopResult?.status && processStopResult.status !== 0
      ? `; remote dev server stop also exited with ${
          processStopResult.status
        }: ${processStopResult.stderr?.trim()}`
      : ""
  fail(`remote-capture-browser failed: ${message}${stopMessage}`)
}

if (processStopResult?.status !== 0) {
  failInspection(
    new Error(
      processStopResult.stderr?.trim() ||
        `remote dev server stop exited with ${processStopResult.status}`,
    ),
    { descriptor, workspaceReference },
  )
}

const issueBlockReason = browserIssueBlockReason(result.browserIssues, {
  allowBrowserIssues: Boolean(args.allowBrowserIssues),
  required: requiresBrowserEvidence(item),
})
tryAppendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "remote-capture-browser.completed",
    artifacts: result.remoteArtifactIndex ?? artifactPlan.artifactPointer,
    blockedBy: issueBlockReason ?? null,
    browserIssueCount: result.browserIssues.length,
    issue: issueEventDetails(item),
    process: processPlan?.processName ?? null,
    remoteDir: artifactPlan.workspace,
    repository,
    required: requiresBrowserEvidence(item),
    url: captureUrl,
    workspace: workspaceReference,
  },
})

console.log("agent-runner remote-capture-browser: wrote browser evidence")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`workspace: ${workspaceReference}`)
if (exposure) console.log(`exposed port: ${exposure.port}`)
console.log(`url: ${captureUrl}`)
console.log(`artifacts: ${artifactPlan.artifactDir}`)
if (processPlan) {
  console.log(`remote process: ${processPlan.processName}`)
  console.log(`remote process log: ${processPlan.logFile}`)
}
console.log("")
console.log("Use this value with --ui-evidence:")
console.log(browserEvidenceText(result))

if (!requiresBrowserEvidence(item)) {
  console.log("")
  console.log("Note: browser evidence is not required by this issue's labels.")
}

if (issueBlockReason) {
  fail(`${issueBlockReason}; pass --allow-browser-issues only with an accepted exception`)
}

async function loadAdapters({ descriptor, workspaceReference }) {
  try {
    return await loadRemoteWorkspaceAdapters({
      configPath: args.adapterConfig,
      repoRoot,
    })
  } catch (error) {
    failInspection(error, { descriptor, workspaceReference })
  }
}

async function startRemoteDevServer({ adapter, item, plan, repository }) {
  const startResult = await runRemoteExec({
    adapter,
    args: [
      "-lc",
      remoteStartProcessShell({
        command: args.devServerCommand,
        plan,
      }),
    ],
    command: "bash",
    cwd: plan.workspace,
    httpPost: true,
  })

  if (startResult.status !== 0) {
    failInspection(
      new Error(
        startResult.stderr?.trim() || `remote dev server exited with ${startResult.status}`,
      ),
      { descriptor, workspaceReference },
    )
  }

  const metadata = remoteProcessMetadata({
    command: args.devServerCommand,
    item,
    plan,
    repository,
  })
  const metadataWrite = await runRemoteExec({
    adapter,
    args: [
      "-lc",
      remoteWriteFileShell({
        content: `${JSON.stringify(metadata, null, 2)}\n`,
        file: plan.metadataFile,
      }),
    ],
    command: "bash",
    cwd: plan.workspace,
    httpPost: true,
  })

  if (metadataWrite.status !== 0) {
    const stopResult = await stopRemoteDevServer({ adapter, plan })
    const stopMessage =
      stopResult.status === 0
        ? ""
        : `; stop also exited with ${stopResult.status}: ${stopResult.stderr?.trim()}`
    failInspection(
      new Error(
        `${
          metadataWrite.stderr?.trim() ||
          `remote dev server metadata write exited with ${metadataWrite.status}`
        }${stopMessage}`,
      ),
      { descriptor, workspaceReference },
    )
  }
}

async function stopRemoteDevServer({ adapter, plan }) {
  return runRemoteExec({
    adapter,
    args: [
      "-lc",
      remoteStopProcessShell({
        plan,
      }),
    ],
    command: "bash",
    cwd: plan.workspace,
    httpPost: true,
  })
}

async function runRemoteExec({ adapter, ...command }) {
  try {
    return await adapter.exec(command)
  } catch (error) {
    return {
      status: 1,
      stderr: error instanceof Error ? error.message : String(error),
      stdout: "",
    }
  }
}

function resolveAdapter(descriptor, { adapters }) {
  try {
    return resolveRemoteWorkspaceAdapter(descriptor, { adapters })
  } catch (error) {
    failInspection(error, { descriptor, workspaceReference })
  }
}

function failInspection(error, { descriptor, workspaceReference }) {
  const message = error instanceof Error ? error.message : String(error)
  fail(
    `${message}; workspace=${workspaceReference}; provider=${
      descriptor.kind === "remote-sandbox" ? descriptor.provider : "unknown"
    }`,
  )
}

function printCapturePlan({
  artifactPlan,
  devServerCommand,
  item,
  port,
  processName,
  repository,
  url,
}) {
  console.log("agent-runner remote-capture-browser would capture:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`workspace: ${artifactPlan.workspaceReference}`)
  console.log(`url: ${url ?? `<expose port ${port}>`}`)
  console.log(`artifacts: ${artifactPlan.artifactDir}`)
  if (devServerCommand) {
    console.log(`remote dev server command: ${devServerCommand}`)
    console.log(`remote process: ${processName ?? "<issue default>"}`)
  }
  if (args.publishArtifacts) {
    console.log("remote artifacts: configured object storage")
  }
}

function numberArg(value, fallback, name) {
  if (value === undefined) return fallback

  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) {
    fail(`invalid ${name}: ${value}`)
  }
  return number
}

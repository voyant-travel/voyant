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
  maybePrintHelp,
  mutationOptions,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"
import {
  normalizeRemoteHttpExposure,
  remoteBrowserArtifactPlan,
} from "./lib/agent-runner-remote-browser.mjs"
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
  usage: "pnpm agent:queue:remote-capture-browser -- --issue <number> --port 3000 --yes",
  options: [
    ["--issue <number>", "Issue number whose remote workspace should receive browser proof."],
    ["--port <number>", "Remote HTTP port to expose through the adapter."],
    ["--url <url>", "Already-exposed URL to capture instead of calling exposeHttp."],
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

if (args.viewport && args.viewports) {
  fail("use either --viewport or --viewports, not both")
}

const timeoutMs = numberArg(args.timeoutMs, 30_000, "timeout-ms")
const port = args.port ? numberArg(args.port, undefined, "port") : undefined
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
  printCapturePlan({ artifactPlan, item, port, repository, url: args.url })
  fail("remote-capture-browser exposes HTTP and writes local artifacts; rerun with --yes")
}

let captureUrl = args.url
let exposure = null
if (!captureUrl) {
  const adapters = await loadAdapters({ descriptor, workspaceReference })
  const adapter = resolveAdapter(descriptor, { adapters })
  if (!adapter.capabilities.exposeHttp) {
    failInspection(
      new Error(`remote workspace provider ${descriptor.provider} cannot expose HTTP ports`),
      { descriptor, workspaceReference },
    )
  }

  try {
    exposure = normalizeRemoteHttpExposure({
      port,
      result: await adapter.exposeHttp(port),
    })
    captureUrl = exposure.url
  } catch (error) {
    failInspection(error, { descriptor, workspaceReference })
  }
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

const { chromium } = await import("playwright").catch((error) => {
  fail(`Playwright is not available: ${error.message}`)
})

let result
try {
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
  fail(`remote-capture-browser failed: ${error.message}`)
}

if (args.publishArtifacts) {
  try {
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
  } catch (error) {
    fail(`remote-capture-browser failed to publish artifacts: ${error.message}`)
  }
}

const issueBlockReason = browserIssueBlockReason(result.browserIssues, {
  allowBrowserIssues: Boolean(args.allowBrowserIssues),
  required: requiresBrowserEvidence(item),
})

console.log("agent-runner remote-capture-browser: wrote browser evidence")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`workspace: ${workspaceReference}`)
if (exposure) console.log(`exposed port: ${exposure.port}`)
console.log(`url: ${captureUrl}`)
console.log(`artifacts: ${artifactPlan.artifactDir}`)
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

function printCapturePlan({ artifactPlan, item, port, repository, url }) {
  console.log("agent-runner remote-capture-browser would capture:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`workspace: ${artifactPlan.workspaceReference}`)
  console.log(`url: ${url ?? `<expose port ${port}>`}`)
  console.log(`artifacts: ${artifactPlan.artifactDir}`)
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

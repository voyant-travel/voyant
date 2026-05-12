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
  maybePrintHelp,
  mutationOptions,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"
import { remoteWriteFileShell } from "./lib/agent-runner-remote-execution.mjs"
import {
  remoteProcessMetadata,
  remoteProcessPlan,
  remoteStartProcessShell,
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
  command: "agent:queue:remote-start-process",
  summary: "Start a named long-running process inside a remote workspace.",
  usage:
    'pnpm agent:queue:remote-start-process -- --issue <number> --name dev-server --command "pnpm dev" --port 3000 --yes',
  options: [
    ["--issue <number>", "Issue number whose remote workspace owns the process."],
    ["--command <shell>", "Long-running shell command to start."],
    ["--name <name>", "Stable process name. Defaults from the issue."],
    ["--port <number>", "Optional HTTP port the process serves."],
    [
      "--workspace <reference>",
      "Workspace reference override, for example sandbox:sprite:task-579.",
    ],
    ["--remote-dir <path>", "Remote repository directory."],
    ["--verify-after <seconds>", "Seconds to wait before checking the process. Defaults to 2."],
    [
      "--adapter-config <path>",
      "Optional remote adapter config module. Defaults to .agents/remote-workspaces.mjs when present.",
    ],
    ["--json", "Print machine-readable JSON."],
    ...repositoryOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("remote-start-process mode requires --issue <number>")
}

if (!args.command) {
  fail("remote-start-process mode requires --command <shell>")
}

if (!args.yes) {
  fail("remote-start-process requires --yes because it starts a remote process")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const item = findProjectIssueItem(project.items, {
  issueNumber: args.issue,
  repository,
})

if (item.issue.state !== "OPEN") {
  fail(`issue #${args.issue} cannot start a process because issue state is ${item.issue.state}`)
}

const workspaceReference = args.workspace ?? item.fields.Workspace ?? item.dryRunPlan.workspace
const descriptor = parseWorkspaceReference(workspaceReference, { repoRoot })
if (!isRemoteWorkspaceDescriptor(descriptor)) {
  fail(
    `remote-start-process requires a remote-sandbox workspace; got ${
      descriptor.kind === "invalid" ? descriptor.reason : descriptor.kind
    }`,
  )
}

const plan = remoteProcessPlan({
  descriptor,
  item,
  name: args.name,
  port: args.port ? numberArg(args.port, "port") : undefined,
  remoteDir: args.remoteDir,
  workspaceReference,
})
const adapters = await loadAdapters({ descriptor, workspaceReference })
const adapter = resolveAdapter(descriptor, { adapters })
if (!adapter.capabilities.exec) {
  failInspection(
    new Error(`remote workspace provider ${descriptor.provider} cannot exec commands`),
    {
      descriptor,
      workspaceReference,
    },
  )
}

const startResult = await runRemoteExec({
  adapter,
  args: [
    "-lc",
    remoteStartProcessShell({
      command: args.command,
      plan,
      verifyAfterSeconds: numberArg(args.verifyAfter, "verify-after", 2),
    }),
  ],
  command: "bash",
  cwd: plan.workspace,
  httpPost: true,
})

if (startResult.status !== 0) {
  failInspection(
    new Error(
      startResult.stderr?.trim() || `remote process start exited with ${startResult.status}`,
    ),
    { descriptor, workspaceReference },
  )
}

const metadata = remoteProcessMetadata({
  command: args.command,
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
  failInspection(
    new Error(
      metadataWrite.stderr?.trim() ||
        `remote process metadata write exited with ${metadataWrite.status}`,
    ),
    { descriptor, workspaceReference },
  )
}

if (args.json) {
  console.log(
    JSON.stringify(
      {
        issue: item.issue,
        metadata,
        metadataWrite,
        repository,
        startResult,
      },
      null,
      2,
    ),
  )
} else {
  if (startResult.stdout) console.log(startResult.stdout)
  if (startResult.stderr) console.error(startResult.stderr)
  console.log("agent-runner remote-start-process: process started")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`workspace: ${workspaceReference}`)
  console.log(`remote dir: ${plan.workspace}`)
  console.log(`process: ${plan.processName}`)
  console.log(`metadata: ${plan.metadataFile}`)
  console.log(`log: ${plan.logFile}`)
  if (plan.port) console.log(`port: ${plan.port}`)
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

function failInspection(error, { descriptor, workspaceReference }) {
  const message = error instanceof Error ? error.message : String(error)
  if (args.json) {
    console.log(
      JSON.stringify(
        {
          error: message,
          repository,
          workspace: {
            descriptor,
            reference: workspaceReference,
          },
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  fail(message)
}

function numberArg(value, name, fallback) {
  if (value === undefined) return fallback

  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) {
    fail(`invalid ${name}: ${value}`)
  }
  return number
}

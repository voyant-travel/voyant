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
import { remoteProcessPlan, remoteStopProcessShell } from "./lib/agent-runner-remote-process.mjs"
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
  command: "agent:queue:remote-stop-process",
  summary: "Stop a named long-running process inside a remote workspace.",
  usage: "pnpm agent:queue:remote-stop-process -- --issue <number> --name dev-server --yes",
  options: [
    ["--issue <number>", "Issue number whose remote workspace owns the process."],
    ["--name <name>", "Stable process name. Defaults from the issue."],
    [
      "--workspace <reference>",
      "Workspace reference override, for example sandbox:sprite:task-579.",
    ],
    ["--remote-dir <path>", "Remote repository directory."],
    ["--grace-seconds <seconds>", "Seconds to wait before SIGKILL. Defaults to 10."],
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
  fail("remote-stop-process mode requires --issue <number>")
}

if (!args.yes) {
  fail("remote-stop-process requires --yes because it stops a remote process")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const item = findProjectIssueItem(project.items, {
  issueNumber: args.issue,
  repository,
})
const workspaceReference = args.workspace ?? item.fields.Workspace ?? item.dryRunPlan.workspace
const descriptor = parseWorkspaceReference(workspaceReference, { repoRoot })
if (!isRemoteWorkspaceDescriptor(descriptor)) {
  fail(
    `remote-stop-process requires a remote-sandbox workspace; got ${
      descriptor.kind === "invalid" ? descriptor.reason : descriptor.kind
    }`,
  )
}

const plan = remoteProcessPlan({
  descriptor,
  item,
  name: args.name,
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

const stopResult = await runRemoteExec({
  adapter,
  args: [
    "-lc",
    remoteStopProcessShell({
      graceSeconds: numberArg(args.graceSeconds, "grace-seconds", 10),
      plan,
    }),
  ],
  command: "bash",
  cwd: plan.workspace,
  httpPost: true,
})

if (stopResult.status !== 0) {
  failInspection(
    new Error(stopResult.stderr?.trim() || `remote process stop exited with ${stopResult.status}`),
    { descriptor, workspaceReference },
  )
}

if (args.json) {
  console.log(
    JSON.stringify(
      {
        issue: item.issue,
        plan,
        repository,
        stopResult,
      },
      null,
      2,
    ),
  )
} else {
  if (stopResult.stdout) console.log(stopResult.stdout)
  if (stopResult.stderr) console.error(stopResult.stderr)
  console.log("agent-runner remote-stop-process: process stopped or already absent")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`workspace: ${workspaceReference}`)
  console.log(`remote dir: ${plan.workspace}`)
  console.log(`process: ${plan.processName}`)
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

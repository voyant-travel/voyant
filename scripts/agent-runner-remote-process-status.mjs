import {
  currentRepositoryFromOrigin,
  fail,
  findProjectIssueItem,
  loadAllEvaluatedProject,
  parseArgs,
  projectScanConfigFromArgs,
  runGit,
} from "./lib/agent-project-queue.mjs"
import { maybePrintHelp, projectOptions, repositoryOptions } from "./lib/agent-runner-help.mjs"
import { remoteProcessPlan, remoteProcessStatusShell } from "./lib/agent-runner-remote-process.mjs"
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
  command: "agent:queue:remote-process-status",
  summary: "Inspect a named long-running process inside a remote workspace.",
  usage:
    "pnpm agent:queue:remote-process-status -- (--issue <number> | --workspace <reference> --name <name>)",
  options: [
    ["--issue <number>", "Issue number whose remote workspace owns the process."],
    ["--name <name>", "Stable process name. Defaults from the issue."],
    [
      "--workspace <reference>",
      "Workspace reference override, for example sandbox:sprite:task-579.",
    ],
    ["--remote-dir <path>", "Remote repository directory."],
    ["--tail-lines <number>", "Number of process log lines to print. Defaults to 80."],
    [
      "--adapter-config <path>",
      "Optional remote adapter config module. Defaults to .agents/remote-workspaces.mjs when present.",
    ],
    ["--json", "Print machine-readable JSON."],
    ...repositoryOptions,
    ...projectOptions,
  ],
})

if (!args.issue && !args.workspace) {
  fail("remote-process-status mode requires --issue <number> or --workspace <reference>")
}

if (!args.issue && !args.name) {
  fail("remote-process-status mode requires --name when --workspace is used without --issue")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = resolveRepository()
const item = args.issue ? loadIssueItem({ repository }) : null
const workspaceReference =
  args.workspace ?? item?.fields.Workspace ?? item?.dryRunPlan.workspace ?? undefined
const descriptor = parseWorkspaceReference(workspaceReference, { repoRoot })
if (!isRemoteWorkspaceDescriptor(descriptor)) {
  fail(
    `remote-process-status requires a remote-sandbox workspace; got ${
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

const statusResult = await runRemoteExec({
  adapter,
  args: [
    "-lc",
    remoteProcessStatusShell({
      plan,
      tailLines: numberArg(args.tailLines, "tail-lines", 80),
    }),
  ],
  command: "bash",
  cwd: plan.workspace,
  httpPost: true,
})

if (statusResult.status !== 0) {
  failInspection(
    new Error(
      statusResult.stderr?.trim() || `remote process status exited with ${statusResult.status}`,
    ),
    { descriptor, workspaceReference },
  )
}

if (args.json) {
  console.log(
    JSON.stringify(
      {
        issue: item?.issue ?? null,
        plan,
        repository,
        statusResult,
      },
      null,
      2,
    ),
  )
} else {
  if (statusResult.stdout) console.log(statusResult.stdout)
  if (statusResult.stderr) console.error(statusResult.stderr)
  console.log("agent-runner remote-process-status: process inspected")
  if (item) console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository ?? "not required"}`)
  console.log(`workspace: ${workspaceReference}`)
  console.log(`remote dir: ${plan.workspace}`)
  console.log(`process: ${plan.processName}`)
}

function loadIssueItem({ repository }) {
  const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
  return findProjectIssueItem(project.items, {
    issueNumber: args.issue,
    repository,
  })
}

function resolveRepository() {
  if (args.repo) return args.repo
  if (!args.issue) return null
  return currentRepositoryFromOrigin(repoRoot)
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

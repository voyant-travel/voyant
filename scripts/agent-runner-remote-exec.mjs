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
import {
  loadRemoteWorkspaceAdapters,
  resolveRemoteWorkspaceAdapter,
} from "./lib/agent-runner-remote-workspace.mjs"
import { parseWorkspaceReference } from "./lib/agent-runner-workspace-contract.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:remote-exec",
  summary: "Run a guarded one-shot command through a configured remote workspace adapter.",
  usage:
    "pnpm agent:queue:remote-exec -- (--issue <number> | --workspace <reference>) --command <shell> --yes",
  options: [
    ["--issue <number>", "Issue number whose Project Workspace field should be used."],
    [
      "--workspace <reference>",
      "Workspace reference override, for example sandbox:sprite:task-579.",
    ],
    ["--command <shell>", "Shell command to execute remotely."],
    ["--cwd <path>", "Remote working directory for the command."],
    [
      "--adapter-config <path>",
      "Optional remote adapter config module. Defaults to .agents/remote-workspaces.mjs when present.",
    ],
    ["--json", "Print machine-readable JSON."],
    ...mutationOptions,
    ...repositoryOptions,
    ...projectOptions,
  ],
})

if (!args.issue && !args.workspace) {
  fail("remote-exec mode requires --issue <number> or --workspace <reference>")
}

if (!args.command) {
  fail("remote-exec mode requires --command <shell>")
}

if (!args.yes) {
  fail("remote-exec requires --yes because it runs a remote command")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = resolveRepository()
const item = args.issue ? loadIssueItem({ repository }) : null
const workspaceReference =
  args.workspace ?? item.fields.Workspace ?? item.dryRunPlan.workspace ?? undefined
const descriptor = parseWorkspaceReference(workspaceReference, { repoRoot })
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

const result = await adapter.exec(remoteCommand())
if (args.json) {
  console.log(
    JSON.stringify(
      {
        issue: item?.issue ?? null,
        repository,
        result,
        workspaceReference,
      },
      null,
      2,
    ),
  )
} else {
  if (result.stdout) console.log(result.stdout)
  if (result.stderr) console.error(result.stderr)
  console.error(`remote-exec exited with status ${result.status}`)
}

process.exitCode = result.status ?? 1

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

function remoteCommand() {
  return {
    args: ["-lc", args.command],
    command: "bash",
    cwd: args.cwd,
    httpPost: true,
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

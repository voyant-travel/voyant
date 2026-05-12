import { updateProjectItemFields } from "./lib/agent-project-fields.mjs"
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
  remoteBootstrapFieldValues,
  remoteBootstrapPlan,
} from "./lib/agent-runner-remote-bootstrap.mjs"
import {
  loadRemoteWorkspaceAdapters,
  resolveRemoteWorkspaceAdapter,
} from "./lib/agent-runner-remote-workspace.mjs"
import { parseWorkspaceReference } from "./lib/agent-runner-workspace-contract.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:remote-bootstrap",
  summary: "Clone or update the repository inside a configured remote workspace.",
  usage: "pnpm agent:queue:remote-bootstrap -- (--issue <number> | --workspace <reference>) --yes",
  options: [
    ["--issue <number>", "Issue number whose Project Workspace field should be bootstrapped."],
    [
      "--workspace <reference>",
      "Workspace reference override, for example sandbox:sprite:task-579.",
    ],
    ["--branch <name>", "Remote branch name. Defaults to the issue execution plan branch."],
    ["--base <ref>", "Remote base ref. Defaults to main."],
    ["--base-ref <ref>", "Alias for --base."],
    ["--remote-dir <path>", "Remote repository directory."],
    ["--repo-url <url>", "Repository clone URL. Defaults to https://github.com/<repo>.git."],
    [
      "--adapter-config <path>",
      "Optional remote adapter config module. Defaults to .agents/remote-workspaces.mjs when present.",
    ],
    ["--json", "Print machine-readable JSON."],
    ...eventLogOptions,
    ...mutationOptions,
    ...repositoryOptions,
    ...projectOptions,
  ],
})

if (!args.issue && !args.workspace) {
  fail("remote-bootstrap mode requires --issue <number> or --workspace <reference>")
}

if (!args.yes) {
  fail("remote-bootstrap requires --yes because it mutates a remote workspace")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = resolveRepository()
const eventLogPath = resolveEventLogPath(args.eventLog, { repoRoot })
const issueContext = args.issue ? loadIssueItem({ repository }) : null
const item = issueContext?.item ?? null
const workspaceReference =
  args.workspace ?? item.fields.Workspace ?? item.dryRunPlan.workspace ?? undefined
const descriptor = parseWorkspaceReference(workspaceReference, { repoRoot })
const plan = resolveBootstrapPlan({ descriptor, item })
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

const result = await adapter.exec({
  args: ["-lc", plan.command],
  command: "bash",
  httpPost: true,
})
const projectUpdated = maybeUpdateProject({ issueContext, plan, result, workspaceReference })
tryAppendAgentRunnerEvent({
  eventLogPath,
  event: {
    type: "remote-bootstrap.completed",
    branch: plan.branch,
    issue: item ? issueEventDetails(item) : null,
    projectUpdated,
    repository,
    result: {
      status: result.status ?? null,
    },
    workspace: workspaceReference,
  },
})

if (args.json) {
  console.log(
    JSON.stringify(
      {
        issue: item?.issue ?? null,
        plan,
        projectUpdated,
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
  console.error(`remote-bootstrap exited with status ${result.status}`)
  if (projectUpdated) {
    console.error("agent state: Planning")
    console.error(`workspace: ${workspaceReference}`)
    console.error(`branch: ${plan.branch}`)
  }
}

process.exitCode = result.status ?? 1

function loadIssueItem({ repository }) {
  const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
  const item = findProjectIssueItem(project.items, {
    issueNumber: args.issue,
    repository,
  })
  return { item, project }
}

function resolveRepository() {
  if (args.repo) return args.repo
  if (args.repoUrl && !args.issue) return null
  return currentRepositoryFromOrigin(repoRoot)
}

function resolveBootstrapPlan({ descriptor, item }) {
  try {
    return remoteBootstrapPlan({
      baseRef: args.base ?? args.baseRef ?? "main",
      branch: args.branch,
      descriptor,
      item,
      remoteDir: args.remoteDir,
      repository,
      repoUrl: args.repoUrl,
    })
  } catch (error) {
    failInspection(error, { descriptor, workspaceReference })
  }
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

function maybeUpdateProject({ issueContext, plan, result, workspaceReference }) {
  if (!issueContext || result.status !== 0) return false

  updateProjectItemFields({
    item: issueContext.item,
    project: issueContext.project,
    values: remoteBootstrapFieldValues({
      branch: plan.branch,
      workspaceReference,
    }),
  })

  return true
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

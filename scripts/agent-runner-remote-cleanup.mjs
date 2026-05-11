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
  maybePrintHelp,
  mutationOptions,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"
import {
  loadRemoteWorkspaceAdapters,
  resolveRemoteWorkspaceAdapter,
} from "./lib/agent-runner-remote-workspace.mjs"
import { canCleanupAgentState, cleanupFieldValues } from "./lib/agent-runner-workspace.mjs"
import {
  isRemoteWorkspaceDescriptor,
  parseWorkspaceReference,
} from "./lib/agent-runner-workspace-contract.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:remote-cleanup",
  summary: "Dispose a completed remote workspace and clear its Project workspace pointer.",
  usage: "pnpm agent:queue:remote-cleanup -- --issue <number> --yes",
  options: [
    ["--issue <number>", "Issue number whose remote workspace should be disposed."],
    [
      "--workspace <reference>",
      "Workspace reference override, for example sandbox:sprite:task-579.",
    ],
    ["--force", "Allow cleanup outside Done or Abandoned Agent State."],
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
  fail("remote-cleanup mode requires --issue <number>")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const item = findProjectIssueItem(project.items, {
  issueNumber: args.issue,
  repository,
})
const agentState = item.fields["Agent State"]

if (!canCleanupAgentState(agentState, { force: Boolean(args.force) })) {
  fail(
    `issue #${args.issue} is not in a cleanup Agent State: ${
      agentState ?? "unset"
    }; pass --force to override`,
  )
}

const workspaceReference = args.workspace ?? item.fields.Workspace ?? item.dryRunPlan.workspace
const descriptor = parseWorkspaceReference(workspaceReference, { repoRoot })
if (!isRemoteWorkspaceDescriptor(descriptor)) {
  fail(
    `remote-cleanup requires a remote-sandbox workspace; got ${
      descriptor.kind === "invalid" ? descriptor.reason : descriptor.kind
    }`,
  )
}

const values = cleanupFieldValues()
const clear = ["Workspace"]

if (!args.yes) {
  printCleanupPlan({ clear, descriptor, item, repository, values, workspaceReference })
  fail("remote-cleanup disposes a remote workspace and updates Project fields; rerun with --yes")
}

const adapters = await loadAdapters({ descriptor, workspaceReference })
const adapter = resolveAdapter(descriptor, { adapters })
if (!adapter.capabilities.dispose) {
  failInspection(
    new Error(`remote workspace provider ${descriptor.provider} cannot dispose workspaces`),
    {
      descriptor,
      workspaceReference,
    },
  )
}

let result
try {
  result = await adapter.dispose({ keepForReview: false })
} catch (error) {
  failInspection(error, { descriptor, workspaceReference })
}

updateProjectItemFields({ clear, item, project, values })

if (args.json) {
  console.log(
    JSON.stringify(
      {
        disposed: result ?? null,
        issue: item.issue,
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
} else {
  console.log(
    "agent-runner remote-cleanup: disposed remote workspace and cleared Project workspace",
  )
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`workspace: ${workspaceReference}`)
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

function printCleanupPlan({ clear, descriptor, item, repository, values, workspaceReference }) {
  console.log("agent-runner remote-cleanup would dispose:")
  console.log(`issue: #${item.issue.number} ${item.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`workspace: ${workspaceReference}`)
  console.log(`provider: ${descriptor.provider}`)
  for (const [fieldName, value] of Object.entries(values)) {
    console.log(`${fieldName}: ${value}`)
  }
  for (const fieldName of clear) {
    console.log(`${fieldName}: <clear>`)
  }
}

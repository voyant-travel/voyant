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
import {
  loadRemoteWorkspaceAdapters,
  resolveRemoteWorkspaceAdapter,
} from "./lib/agent-runner-remote-workspace.mjs"
import { parseWorkspaceReference } from "./lib/agent-runner-workspace-contract.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:remote-inspect",
  summary: "Inspect a remote sandbox workspace reference without mutating it.",
  usage: "pnpm agent:queue:remote-inspect -- (--issue <number> | --workspace <reference>)",
  options: [
    ["--issue <number>", "Issue number whose Project Workspace field should be inspected."],
    [
      "--workspace <reference>",
      "Workspace reference override, for example sandbox:sprite:task-579.",
    ],
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
  fail("remote-inspect mode requires --issue <number> or --workspace <reference>")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = resolveRepository()
const item = args.issue ? loadIssueItem({ repository }) : null
const workspaceReference =
  args.workspace ?? item.fields.Workspace ?? item.dryRunPlan.workspace ?? undefined
const descriptor = parseWorkspaceReference(workspaceReference, { repoRoot })
const adapters = await loadAdapters({ descriptor, workspaceReference })
const adapter = resolveAdapter(descriptor, { adapters })
const inspection = adapter ? await adapter.inspect() : null
const result = {
  issue: item?.issue ?? null,
  repository,
  workspace: {
    descriptor,
    reference: workspaceReference,
  },
  remote: inspection,
}

if (args.json) {
  console.log(JSON.stringify(result, null, 2))
} else {
  printHumanSummary(result)
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

function printHumanSummary({ issue, remote, repository, workspace }) {
  console.log("agent-runner remote-inspect:")
  if (issue) {
    console.log(`issue: #${issue.number} ${issue.title}`)
  }
  console.log(`repository: ${repository ?? "not required"}`)
  console.log(`workspace: ${workspace.reference}`)
  console.log(`kind: ${workspace.descriptor.kind}`)
  console.log(`provider: ${workspace.descriptor.provider ?? "none"}`)
  console.log(`ready: ${remote?.ready ? "yes" : "no"}`)
  console.log(`reason: ${remote?.reason ?? "none"}`)
  if (remote?.availableProviders?.length > 0) {
    console.log(`available providers: ${remote.availableProviders.join(", ")}`)
  }
}

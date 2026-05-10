import { spawnSync } from "node:child_process"

import {
  filterItemsByRepository,
  loadAllEvaluatedProject,
  parseArgs,
  projectScanConfigFromArgs,
} from "./lib/agent-project-queue.mjs"
import { maybePrintHelp, projectOptions, repositoryOptions } from "./lib/agent-runner-help.mjs"

const requiredFields = [
  {
    name: "Status",
    type: "SINGLE_SELECT",
    options: ["Todo", "In Progress", "Done"],
  },
  {
    name: "Agent State",
    type: "SINGLE_SELECT",
    options: [
      "Triage",
      "Ready",
      "Planning",
      "Running",
      "Blocked",
      "Human Review",
      "Changes Requested",
      "CI Repair",
      "Merge Ready",
      "Done",
      "Abandoned",
    ],
  },
  {
    name: "Maintainer Approved",
    type: "SINGLE_SELECT",
    options: ["No", "Yes"],
  },
  {
    name: "Risk",
    type: "SINGLE_SELECT",
    options: ["Low", "Medium", "High", "Unknown"],
  },
  {
    name: "Security Risk",
    type: "SINGLE_SELECT",
    options: ["None", "Sensitive", "Needs security review"],
  },
  {
    name: "Verification Lane",
    type: "SINGLE_SELECT",
    options: ["package", "verify:fast", "verify:full", "custom"],
  },
  {
    name: "Triage Provider",
    type: "SINGLE_SELECT",
    options: ["manual"],
  },
  {
    name: "Agent Provider",
    type: "SINGLE_SELECT",
    options: ["codex", "claude", "manual", "none"],
  },
  { name: "Workspace", type: "TEXT" },
  { name: "Branch", type: "TEXT" },
  { name: "PR", type: "TEXT" },
  { name: "Last Heartbeat", type: "DATE" },
  { name: "Blocked By", type: "TEXT" },
  { name: "Evidence", type: "TEXT" },
]

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:doctor",
  summary: "Check local runner prerequisites, Project visibility, and required Project fields.",
  usage: "pnpm agent:queue:doctor -- [--json] [--repo <owner/name>]",
  options: [["--json", "Print machine-readable JSON."], ...repositoryOptions, ...projectOptions],
})

const results = []
const ghStatus = runCommand("gh", ["auth", "status"])
recordCommand({
  name: "gh auth",
  ok: ghStatus.status === 0,
  detail: ghStatus.status === 0 ? "GitHub CLI is authenticated." : commandOutput(ghStatus),
})

const repo = args.repo ?? currentRepository()
if (repo) {
  record({ name: "repository", ok: true, detail: `Using repository scope ${repo}.` })
} else {
  record({
    name: "repository",
    ok: false,
    detail: "Could not determine repository from origin remote; pass --repo <owner/name>.",
  })
}

let project
if (ghStatus.status === 0) {
  project = loadProject()
}

if (project) {
  record({
    name: "project visibility",
    ok: true,
    detail: `Loaded ${project.projectTitle} (${project.owner}/projects/${project.projectNumber}).`,
  })
  checkRequiredFields(project)
  checkQueue(project, repo)
}

if (args.json) {
  console.log(
    JSON.stringify(
      {
        ok: results.every((result) => result.ok),
        results,
      },
      null,
      2,
    ),
  )
} else {
  printHumanSummary()
}

process.exitCode = results.every((result) => result.ok) ? 0 : 1

function loadProject() {
  try {
    return loadAllEvaluatedProject({
      ...projectScanConfigFromArgs(args),
      onError(message) {
        throw new Error(message)
      },
    })
  } catch (error) {
    record({
      name: "project visibility",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}

function checkRequiredFields(project) {
  for (const expectedField of requiredFields) {
    const field = project.fieldDefinitions.find(
      (candidate) => candidate.name === expectedField.name,
    )
    if (!field) {
      record({
        name: `Project field ${expectedField.name}`,
        ok: false,
        detail: "Missing required Project field.",
      })
      continue
    }

    if (field.dataType !== expectedField.type) {
      record({
        name: `Project field ${expectedField.name}`,
        ok: false,
        detail: `Expected ${expectedField.type}, found ${field.dataType}.`,
      })
      continue
    }

    const missingOptions = (expectedField.options ?? []).filter(
      (option) => !field.options.some((candidate) => candidate.name === option),
    )
    if (missingOptions.length > 0) {
      record({
        name: `Project field ${expectedField.name}`,
        ok: false,
        detail: `Missing option(s): ${missingOptions.join(", ")}.`,
      })
      continue
    }

    record({
      name: `Project field ${expectedField.name}`,
      ok: true,
      detail: "Configured.",
    })
  }
}

function checkQueue(project, repo) {
  const scopedItems = repo ? filterItemsByRepository(project.items, repo) : project.items
  const readyItems = scopedItems.filter((item) => item.ready)
  record({
    name: "queue visibility",
    ok: true,
    detail: `Scanned ${scopedItems.length} item(s); ${readyItems.length} executable item(s).`,
  })
}

function currentRepository() {
  const remote = runCommand("git", ["remote", "get-url", "origin"])
  if (remote.status !== 0) return undefined
  return repositoryFromGitHubRemote(remote.stdout.trim())
}

function repositoryFromGitHubRemote(remoteUrl) {
  const normalized = remoteUrl.trim().replace(/\.git$/, "")
  return normalized.match(/github\.com[:/]([^/]+\/[^/]+)$/)?.[1]
}

function recordCommand({ name, ok, detail }) {
  record({
    detail: detail || "Command produced no output.",
    name,
    ok,
  })
}

function record(result) {
  results.push(result)
}

function printHumanSummary() {
  const ok = results.every((result) => result.ok)
  console.log(`agent-runner doctor: ${ok ? "OK" : "FAILED"}`)
  console.log("")
  for (const result of results) {
    console.log(`${result.ok ? "OK" : "FAIL"} ${result.name}`)
    console.log(`  ${result.detail}`)
  }
}

function runCommand(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
  })
  return {
    error: result.error,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

function commandOutput(result) {
  if (result.error) return result.error.message
  return result.stderr.trim() || result.stdout.trim() || `command exited with ${result.status}`
}

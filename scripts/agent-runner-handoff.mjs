import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

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
import { browserEvidenceMissingReason } from "./lib/agent-runner-browser-evidence.mjs"
import { browserEvidenceQualityBlockReason } from "./lib/agent-runner-browser-validation.mjs"
import {
  maybePrintHelp,
  mutationOptions,
  projectOptions,
  repositoryOptions,
} from "./lib/agent-runner-help.mjs"
import { localWorkspaceReferencePlan } from "./lib/agent-runner-workspace.mjs"

const handoffStates = new Set(["Planning", "Running", "Changes Requested", "CI Repair"])

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:handoff",
  summary: "Write an evidence packet and move claimed work to human review.",
  usage: 'pnpm agent:queue:handoff -- --issue <number> --summary "..." --verification "..." --yes',
  options: [
    ["--issue <number>", "Issue number to hand off."],
    ["--summary <text>", "Human-readable summary for the evidence packet."],
    ["--verification <text>", "Verification command and outcome for the evidence packet."],
    [
      "--ui-evidence <text>",
      "Required browser artifacts or approved exception for UI-labeled work.",
    ],
    [
      "--allow-browser-issues",
      "Allow UI evidence with browser quality issues after maintainer review.",
    ],
    ["--evidence-path <path>", "Evidence path relative to the task workspace."],
    ["--branch <name>", "Branch reference to record in the evidence packet."],
    ["--workspace <path>", "Workspace path override."],
    ["--force", "Allow handoff outside the normal handoff states."],
    ...repositoryOptions,
    ...mutationOptions,
    ...projectOptions,
  ],
})

if (!args.issue) {
  fail("handoff mode requires --issue <number>")
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"])
const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
const project = loadAllEvaluatedProject(projectScanConfigFromArgs(args))
const item = findProjectIssueItem(project.items, {
  issueNumber: args.issue,
  repository,
})
const currentState = item.fields["Agent State"]

if (item.issue.state !== "OPEN") {
  fail(`issue #${args.issue} cannot be handed off because issue state is ${item.issue.state}`)
}

if (!args.force && !handoffStates.has(currentState)) {
  fail(
    `issue #${args.issue} is not in a handoff Agent State: ${
      currentState ?? "unset"
    }; pass --force to override`,
  )
}

if (!args.summary) {
  fail("handoff mode requires --summary <text>")
}

if (!args.verification) {
  fail("handoff mode requires --verification <command-and-outcome>")
}

const missingBrowserEvidence = browserEvidenceMissingReason(item, args.uiEvidence)
if (missingBrowserEvidence && !args.force) {
  fail(`${missingBrowserEvidence}; pass --ui-evidence or --force with an accepted exception`)
}

const workspaceReference = args.workspace ?? item.fields.Workspace ?? item.dryRunPlan.workspace
const branchReference = item.fields.Branch ?? item.dryRunPlan.branch
const { workspace } = localWorkspaceReferencePlan({
  commandName: "handoff mode",
  repoRoot,
  workspaceReference,
})
if (!existsSync(workspace)) {
  fail(`workspace does not exist: ${workspace}`)
}

const browserEvidenceQualityReason = browserEvidenceQualityBlockReason({
  allowBrowserIssues: Boolean(args.allowBrowserIssues),
  item,
  uiEvidence: args.uiEvidence,
  workspace,
})
if (browserEvidenceQualityReason) {
  fail(
    `${browserEvidenceQualityReason}; pass --allow-browser-issues only with an accepted exception`,
  )
}

const evidencePointer =
  args.evidencePath ??
  path.posix.join(
    "docs/agent-evidence/active",
    `${item.issue.number}-${slugFromTitle(item.issue.title)}.md`,
  )
const evidencePath = path.resolve(workspace, evidencePointer)
const values = {
  "Agent State": "Human Review",
  "Last Heartbeat": today(),
  Evidence: evidencePointer,
}
const clear = ["Blocked By"]

if (!args.yes) {
  printUpdate(item, values, clear, evidencePath)
  fail("handoff mode writes an evidence packet and updates GitHub Project fields; rerun with --yes")
}

mkdirSync(path.dirname(evidencePath), { recursive: true })
writeFileSync(
  evidencePath,
  buildEvidencePacket(item, { branch: branchReference, evidencePointer, repository, workspace }),
  "utf8",
)
updateProjectItemFields({ project, item, values, clear })

console.log("agent-runner handoff: wrote evidence packet and updated GitHub Project fields")
console.log(`issue: #${item.issue.number} ${item.issue.title}`)
console.log(`repository: ${repository}`)
console.log(`evidence: ${evidencePath}`)
console.log("agent state: Human Review")
console.log("")
console.log("No agent was run. No branch was pushed.")

function buildEvidencePacket(selectedItem, { branch, evidencePointer, repository, workspace }) {
  return `# Evidence Packet: ${selectedItem.issue.title}

Issue: ${selectedItem.issue.url}
Repository: ${repository}
Branch: ${branch}
Workspace: ${workspace}
Evidence: ${evidencePointer}
Handoff state: Human Review
Generated: ${new Date().toISOString()}

## Summary

${args.summary}

## Files Touched

${formatList(args.files)}

## Verification

${args.verification}

## UI Evidence

${args.uiEvidence ?? "Not applicable or not provided."}

## Links

- PR: ${args.pr ?? "Not provided."}
- CI: ${args.ci ?? "Not provided."}
- Logs: ${args.logs ?? "Not provided."}

## Residual Risks

${args.risks ?? "No known residual risks provided."}

## Security Considerations

${args.security ?? "No security-sensitive changes reported."}

## Notes

${args.notes ?? "No additional notes."}
`
}

function printUpdate(selectedItem, fieldValues, clearFields, evidencePath) {
  console.log("agent-runner handoff would update:")
  console.log(`issue: #${selectedItem.issue.number} ${selectedItem.issue.title}`)
  console.log(`repository: ${repository}`)
  console.log(`evidence file: ${evidencePath}`)
  for (const [fieldName, value] of Object.entries(fieldValues)) {
    console.log(`${fieldName}: ${value}`)
  }
  for (const fieldName of clearFields) {
    console.log(`${fieldName}: <clear>`)
  }
}

function formatList(value) {
  if (!value) return "- Not provided."
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => `- ${entry}`)
    .join("\n")
}

function slugFromTitle(title) {
  const slug = title
    .toLowerCase()
    .replace(/^\[(task|bug|refactor|investigation|cleanup)\]\s*:?\s*/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")

  return slug || "agent-task"
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

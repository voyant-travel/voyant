import path from "node:path"

import {
  browserArtifactPlan,
  browserEvidenceEnvironment,
  browserEvidenceMissingReason,
  requiresBrowserEvidence,
} from "./agent-runner-browser-evidence.mjs"
import { ciRepairEvidenceEnvironment, resolveCiRepairEvidencePath } from "./agent-runner-ci.mjs"
import { localWorkspaceReferencePlan } from "./agent-runner-workspace.mjs"
import {
  parseWorkspaceReference,
  workspaceDescriptorEnvironment,
} from "./agent-runner-workspace-contract.mjs"

export const commandRunStates = new Set(["Planning", "Running", "Changes Requested", "CI Repair"])

export function canRunCommandState(agentState, { force = false } = {}) {
  return force || commandRunStates.has(agentState)
}

export function commandRunArtifactPlan({
  date = new Date(),
  evidencePath,
  item,
  repoRoot,
  workspaceReference,
}) {
  const slug = slugFromTitle(item.issue.title)
  const timestamp = date.toISOString().replace(/[:.]/g, "-")
  const localWorkspace = localWorkspaceReferencePlan({
    commandName: "run-command mode",
    repoRoot,
    workspaceReference,
  })
  const workspace = localWorkspace.workspace
  const evidencePointer =
    evidencePath ?? path.posix.join("docs/agent-evidence/active", `${item.issue.number}-${slug}.md`)
  const evidenceFile = path.resolve(workspace, evidencePointer)
  const logFile = path.resolve(
    repoRoot,
    ".agent-runs",
    `${item.issue.number}-${slug}`,
    `${timestamp}.log`,
  )

  return {
    evidenceFile,
    evidencePointer,
    logFile,
    repoRoot,
    safeEvidencePath: isPathInside(evidenceFile, workspace),
    workspace,
    workspaceReference: localWorkspace.workspaceReference,
  }
}

export function commandRunEnvironment({ artifactPlan, branch, item, repository }) {
  const browserPlan = browserArtifactPlan({
    item,
    repoRoot: artifactPlan.repoRoot,
    workspaceReference: artifactPlan.workspaceReference,
  })
  const workspaceDescriptor = parseWorkspaceReference(artifactPlan.workspaceReference, {
    repoRoot: artifactPlan.repoRoot,
  })

  return {
    ...browserEvidenceEnvironment({ artifactPlan: browserPlan }),
    ...ciRepairEvidenceEnvironment({
      evidenceReference: item.fields.Evidence,
      repoRoot: artifactPlan.repoRoot,
    }),
    ...workspaceDescriptorEnvironment(workspaceDescriptor),
    VOYANT_AGENT_BRANCH: branch,
    VOYANT_AGENT_EVIDENCE_PATH: artifactPlan.evidenceFile,
    VOYANT_AGENT_EVIDENCE_REFERENCE: artifactPlan.evidencePointer,
    VOYANT_AGENT_ISSUE: String(item.issue.number),
    VOYANT_AGENT_ISSUE_TITLE: item.issue.title,
    VOYANT_AGENT_ISSUE_URL: item.issue.url,
    VOYANT_AGENT_LOG_PATH: artifactPlan.logFile,
    VOYANT_AGENT_PLAN_PATH: path.resolve(artifactPlan.workspace, item.dryRunPlan.planPath),
    VOYANT_AGENT_REPOSITORY: repository,
    VOYANT_AGENT_VERIFICATION_LANE: item.dryRunPlan.verificationLane,
    VOYANT_AGENT_WORKSPACE: artifactPlan.workspace,
  }
}

export function commandRunBrowserEvidenceBlockReason({
  exitCode,
  force = false,
  item,
  uiEvidence,
}) {
  if (exitCode !== 0 || force) return null

  const missingReason = browserEvidenceMissingReason(item, uiEvidence)
  if (!missingReason) return null

  return `${missingReason}; pass --ui-evidence or --force with an accepted exception`
}

export function commandRunFieldUpdate({ blockedBy, date = new Date(), evidencePointer, exitCode }) {
  const blocked = exitCode !== 0 || Boolean(blockedBy)
  const values = {
    "Agent State": blocked ? "Blocked" : "Human Review",
    "Last Heartbeat": date.toISOString().slice(0, 10),
    Evidence: evidencePointer,
  }

  if (blocked) {
    values["Blocked By"] = blockedBy ?? `run-command exited with ${exitCode}`
  }

  return {
    clear: blocked ? [] : ["Blocked By"],
    values,
  }
}

export function buildCommandEvidencePacket({
  artifactPlan,
  branch,
  command,
  exitCode,
  item,
  repository,
  startedAt,
  stoppedAt,
  blockedBy,
  uiEvidence,
}) {
  const state = exitCode === 0 && !blockedBy ? "Human Review" : "Blocked"

  return `# Evidence Packet: ${item.issue.title}

Issue: ${item.issue.url}
Repository: ${repository}
Branch: ${branch}
Workspace: ${artifactPlan.workspace}
Evidence: ${artifactPlan.evidencePointer}
Handoff state: ${state}
Generated: ${stoppedAt.toISOString()}

## Summary

Supervised command completed with exit code ${exitCode}.
${blockedBy ? `\nRun-command handoff blocked: ${blockedBy}.\n` : ""}

## Command

\`\`\`bash
${command}
\`\`\`

## Timing

- Started: ${startedAt.toISOString()}
- Stopped: ${stoppedAt.toISOString()}

## Verification

Runner command transcript: ${artifactPlan.logFile}

## Browser Evidence

${formatBrowserEvidenceRequirement(item, uiEvidence)}

## CI Repair Evidence

${formatCiRepairEvidenceReference({ item, repoRoot: artifactPlan.repoRoot })}

## Residual Risks

Review the command transcript and resulting diff before opening or merging a PR.
`
}

function formatBrowserEvidenceRequirement(item, uiEvidence) {
  if (!requiresBrowserEvidence(item)) {
    return "Not required by issue labels."
  }

  if (uiEvidence?.trim()) {
    return uiEvidence.trim()
  }

  return "Required for UI-labeled work. Attach screenshots, console log, failed-request log, and video or note the maintainer-approved exception."
}

function formatCiRepairEvidenceReference({ item, repoRoot }) {
  const evidenceReference = item.fields.Evidence
  const evidencePath = resolveCiRepairEvidencePath({ evidenceReference, repoRoot })
  if (!evidencePath) {
    return "Not applicable."
  }

  return `Repair packet: ${evidencePath}
Reference: ${evidenceReference}`
}

function isPathInside(candidatePath, parentPath) {
  const relative = path.relative(parentPath, candidatePath)
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative)
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
